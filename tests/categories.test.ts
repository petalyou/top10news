/** Content-based categories: the single Gemini desk request re-files stories and drops off-topic ones. */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const dir = await mkdtemp(path.join(tmpdir(), "top10-cat-"));
process.env.LOCAL_DATA_DIR = dir;
const { runHourlyIngest } = await import("../lib/ingest/pipeline");
const { findDuplicateGroups } = await import("../lib/ingest/synthesize");
const { readEditionUncached } = await import("../lib/storage");
const { addHours, toHourKey, truncateToHour } = await import("../lib/hour");
const { articlesFor, BASE_EVENTS } = await import("./fixtures");
after(() => rm(dir, { recursive: true, force: true }));

const O = (outlet: string, tier: 1 | 2 | 3) => ({ outlet, tier });
const SPACEX = { category: "politics" as const, titles: ["SpaceX Starship prepares for second booster catch attempt"], outlets: [O("BBC News", 1), O("NPR", 1)], minutesAgo: 12 };
const SPORT = { category: "politics" as const, titles: ["Chiefs beat Bills in overtime thriller"], outlets: [O("Fox News", 2), O("CBS News", 2)], minutesAgo: 14 };

test("pipeline moves a misfiled story to its content category and leaves out off-topic ones", async () => {
  const hour = addHours(truncateToHour(new Date()), -3);
  const synth = async (_c: unknown, cl: { articles: { title: string }[] }[]) => cl.map((c) => ({ headline: c.articles[0].title, summary: "S.", whyItMatters: "W." }));
  await runHourlyIngest({
    hour,
    now: addHours(hour, -5 / 60),
    deps: {
      fetch: async (n = new Date()) => ({ articles: articlesFor([...BASE_EVENTS, SPACEX, SPORT], n), feedErrors: [] }),
      synthesize: synth as never,
      dedupe: async (byCat) => {
        const categories: Record<string, "tech" | "other"> = {};
        for (const cl of Object.values(byCat)) for (const c of cl ?? []) {
          if (c.articles[0].title.includes("Starship")) categories[c.id] = "tech";
          if (c.articles[0].title.includes("Chiefs")) categories[c.id] = "other";
        }
        return { groups: [], categories };
      },
    },
  });
  const e = (await readEditionUncached(toHourKey(hour)))!;
  const all = (cat: keyof typeof e.stories) => e.stories[cat].map((s) => s.headline).join(" | ");
  assert.match(all("tech"), /Starship/);
  assert.doesNotMatch(all("politics"), /Starship|Chiefs/);
  assert.doesNotMatch(Object.values(e.stories).flat().map((s) => s.headline).join(" "), /Chiefs/);
});

test("desk call: parses categories, never groups across final categories, survives failures", async () => {
  process.env.GEMINI_API_KEY = "k";
  const mk = (id: string, title: string) => ({ id, category: "politics", articles: [{ outlet: "BBC News", title }], tokens: new Set(), score: 0, distinctOutlets: 1, newestAt: new Date() });
  const byCat = { politics: [mk("p1", "Starship launch"), mk("p2", "Senate vote"), mk("p3", "Senate passes bill")] } as never;
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        groups: [["p2", "p3"], ["p1", "p2"]],
        categories: [{ id: "p1", category: "tech" }, { id: "p2", category: "politics" }, { id: "p3", category: "politics" }, { id: "zzz", category: "world" }],
      }) }] } }] }))) as typeof fetch;
    const r = await findDuplicateGroups(byCat);
    assert.deepEqual(r.categories, { p1: "tech", p2: "politics", p3: "politics" });
    assert.deepEqual(r.groups, [["p2", "p3"]]);
    globalThis.fetch = (async () => new Response("quota", { status: 403 })) as unknown as typeof fetch;
    assert.deepEqual(await findDuplicateGroups(byCat), { groups: [], categories: {} });
  } finally {
    globalThis.fetch = realFetch;
  }
});
