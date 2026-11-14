/** Freshness ranking: first-time stories get a boost; stories past 3h in the Top 10 decay. */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const dir = await mkdtemp(path.join(tmpdir(), "top10-fresh-"));
process.env.LOCAL_DATA_DIR = dir;

const { runHourlyIngest } = await import("../lib/ingest/pipeline");
const { readEditionUncached } = await import("../lib/storage");
const { addHours, toHourKey, truncateToHour } = await import("../lib/hour");
const { freshnessMultiplier, hoursInTop, FRESHNESS } = await import("../lib/ingest/freshness");
const { articlesFor } = await import("./fixtures");
type Ev = Parameters<typeof articlesFor>[0][number];

after(() => rm(dir, { recursive: true, force: true }));

test("freshness multiplier: boost new, keep 3h grace, then decay to a floor", () => {
  assert.equal(freshnessMultiplier(1), FRESHNESS.newBoost);
  assert.equal(freshnessMultiplier(2), 1);
  assert.equal(freshnessMultiplier(3), 1);
  assert.ok(freshnessMultiplier(4) < 1);
  assert.ok(freshnessMultiplier(6) < freshnessMultiplier(4));
  assert.equal(freshnessMultiplier(100), FRESHNESS.floor);
  const base: import("../lib/types").Story = { id: "", category: "tech", rank: 1, rankChange: "=", headline: "", summary: "", whyItMatters: "", sources: [], storyKey: "k" };
  assert.equal(hoursInTop(null, "2026-11-12-10"), 1);
  assert.equal(hoursInTop({ ...base, firstSeen: "2026-11-12-07" }, "2026-11-12-10"), 4);
  assert.equal(hoursInTop({ ...base }, "2026-11-12-10"), 2);
});

test("a story in the Top 10 for 5 hours drops below a slightly smaller first-time story", async () => {
  const O = (outlet: string, tier: 1 | 2 | 3) => ({ outlet, tier });
  const OLD: Ev = {
    category: "finance",
    titles: ["Fed holds interest rates steady amid inflation worries"],
    outlets: [O("Bloomberg", 1), O("New York Times", 1), O("BBC News", 1), O("The Guardian", 1)],
    minutesAgo: 10,
  };
  const NEW: Ev = {
    category: "finance",
    titles: ["Boeing secures massive aircraft order from Gulf carrier"],
    outlets: [O("Bloomberg", 1), O("New York Times", 1), O("BBC News", 1), O("MarketWatch", 3)],
    minutesAgo: 5,
  };
  const synth = async (_c: unknown, cl: { articles: { title: string }[] }[]) => cl.map((c) => ({ headline: c.articles[0].title, summary: "S.", whyItMatters: "W." }));
  const deps = (events: Ev[]) => ({
    fetch: async (n = new Date()) => ({ articles: articlesFor(events, n), feedErrors: [] }),
    synthesize: synth as never,
    dedupe: async () => ({ groups: [], categories: {} }),
  });

  const h0 = addHours(truncateToHour(new Date()), -10);
  for (let i = 0; i < 4; i++) {
    const hour = addHours(h0, i);
    await runHourlyIngest({ hour, now: addHours(hour, -5 / 60), deps: deps([OLD]) });
  }
  const h4 = addHours(h0, 4);
  await runHourlyIngest({ hour: h4, now: addHours(h4, -5 / 60), deps: deps([OLD, NEW]) });

  const e3 = (await readEditionUncached(toHourKey(addHours(h0, 3))))!;
  const e4 = (await readEditionUncached(toHourKey(h4)))!;
  assert.equal(e3.stories.finance[0].firstSeen, toHourKey(h0));
  const [first, second] = e4.stories.finance;
  assert.match(first.headline, /Boeing/);
  assert.equal(first.rankChange, "NEW");
  assert.equal(first.firstSeen, toHourKey(h4));
  assert.match(second.headline, /Fed/);
  assert.equal(second.rankChange, "-1");
  assert.equal(second.firstSeen, toHourKey(h0));
  assert.equal(second.storyKey, e3.stories.finance[0].storyKey);
});

test("a category short of 10 stories is backfilled from a wider 12h window, without duplicates", async () => {
  const { BASE_EVENTS } = await import("./fixtures");
  const older: Ev[] = Array.from({ length: 8 }, (_, i) => ({
    category: "tech" as const,
    titles: [
      [
        "Apple delays smart home hub",
        "Microsoft patches Exchange zero-day",
        "Samsung reveals 2nm phone processor",
        "OpenSSL fixes certificate parsing flaw",
        "Meta tests paid Threads tier",
        "Intel foundry signs hyperscaler",
        "Oracle expands Texas datacenter",
        "Spotify raises premium prices",
      ][i],
    ],
    outlets: [{ outlet: "Ars Technica", tier: 3 as const }],
    minutesAgo: 300 + i * 10,
  }));
  const windows: number[] = [];
  const hour = addHours(truncateToHour(new Date()), 30);
  await runHourlyIngest({
    hour,
    now: addHours(hour, -5 / 60),
    deps: {
      fetch: async (n = new Date(), hours = 4) => {
        windows.push(hours);
        return { articles: articlesFor(hours > 4 ? [...BASE_EVENTS, ...older] : BASE_EVENTS, n), feedErrors: [] };
      },
      synthesize: (async (_c: unknown, cl: { articles: { title: string }[] }[]) => cl.map((c) => ({ headline: c.articles[0].title, summary: "S.", whyItMatters: "W." }))) as never,
      dedupe: async () => ({ groups: [], categories: {} }),
    },
  });
  assert.deepEqual(windows, [4, 12]);
  const e = (await readEditionUncached(toHourKey(hour)))!;
  assert.equal(e.stories.tech.length, 10);
  assert.equal(new Set(e.stories.tech.map((s) => s.headline)).size, 10);
  assert.match(e.stories.tech[0].headline, /Huang|Nvidia/); // backfill never outranks the live window
  assert.deepEqual(e.stories.tech.map((s) => s.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
