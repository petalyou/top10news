/** End-to-end pipeline against the local JSON store (temp dir; no network, no Gemini). */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const dir = await mkdtemp(path.join(tmpdir(), "top10-"));
process.env.LOCAL_DATA_DIR = dir;

const { runHourlyIngest } = await import("../lib/ingest/pipeline");
const { getLiveEdition, getEdition, listEditionKeys } = await import("../lib/editions");
const { addHours, truncateToHour, toHourKey } = await import("../lib/hour");
const { articlesFor, BASE_EVENTS } = await import("./fixtures");

after(() => rm(dir, { recursive: true, force: true }));

const fakeSynth = async (_c: unknown, clusters: { articles: { title: string }[] }[]) =>
  clusters.map((c) => ({ headline: c.articles[0].title, summary: "One. Two.", whyItMatters: "Matters." }));
const deps = (events: typeof BASE_EVENTS) => ({
  fetch: async (n = new Date()) => ({ articles: articlesFor(events, n), feedErrors: [] }),
  synthesize: fakeSynth as never,
  dedupe: async () => ({ groups: [], categories: {} }),
});

test("hourly JSON snapshots: immutable files, index, latest, rank diffs, :00 go-live", async () => {
  const current = truncateToHour(new Date());
  const h0 = addHours(current, -2);
  const events2 = BASE_EVENTS.map((e) =>
    e.titles[0].includes("AlphaGenome")
      ? { ...e, outlets: [...e.outlets, ...["Wired", "TechCrunch", "The Verge", "Ars Technica"].map((outlet) => ({ outlet, tier: 2 as const }))] }
      : e,
  );

  for (const [i, events] of [BASE_EVENTS, events2, events2].entries()) {
    const hour = addHours(h0, i);
    const r = await runHourlyIngest({ hour, now: addHours(hour, -5 / 60), deps: deps(events) });
    assert.equal(r.status, "published");
    assert.equal(r.storage, "local");
  }

  const k = (i: number) => toHourKey(addHours(h0, i));
  const index = JSON.parse(await readFile(path.join(dir, "snapshots/index.json"), "utf8"));
  assert.deepEqual(index, [k(2), k(1), k(0)]);
  assert.equal(JSON.parse(await readFile(path.join(dir, "snapshots/latest.json"), "utf8")).key, k(2));

  const e0 = (await getEdition(k(0)))!;
  const e1 = (await getEdition(k(1)))!;
  const e2 = (await getEdition(k(2)))!;
  // The very first edition has nothing to compare against, so nothing is labelled NEW.
  assert.ok(e0.stories.tech.every((s) => s.rankChange === ""));
  const a0 = e0.stories.tech.find((s) => s.headline.includes("AlphaGenome"))!;
  const a1 = e1.stories.tech.find((s) => s.headline.includes("AlphaGenome"))!;
  assert.equal(a1.storyKey, a0.storyKey);
  assert.equal(a1.rankChange, `+${a0.rank - a1.rank}`);
  assert.ok(e2.stories.tech.every((s) => s.rankChange === "="));
  assert.equal(e2.stories.tech[0].id, `${k(2)}-tech-1`);

  // Immutable: re-running an hour does nothing.
  const again = await runHourlyIngest({ hour: h0, deps: { fetch: async () => { throw new Error("should not fetch"); } } });
  assert.equal(again.status, "skipped_already_published");

  // The :55 run for the next hour updates latest.json, but readers keep seeing
  // the current hour until :00.
  const next = addHours(current, 1);
  assert.equal((await runHourlyIngest({ hour: next, now: addHours(next, -5 / 60), deps: deps(events2) })).status, "published");
  assert.equal(JSON.parse(await readFile(path.join(dir, "snapshots/latest.json"), "utf8")).key, toHourKey(next));
  assert.equal((await getLiveEdition())!.key, k(2));
  assert.equal(await getEdition(toHourKey(next)), null);
  assert.deepEqual(await listEditionKeys(), [k(2), k(1), k(0)]);
  // ...and at the top of the hour it is live.
  const atNext = addHours(next, 0.001);
  assert.equal((await getLiveEdition(atNext))!.key, toHourKey(next));

  // Backfilling an older hour doesn't move latest.json backwards.
  await runHourlyIngest({ hour: addHours(h0, -1), now: addHours(h0, -1.1), deps: deps(BASE_EVENTS) });
  assert.equal(JSON.parse(await readFile(path.join(dir, "snapshots/latest.json"), "utf8")).key, toHourKey(next));
});

test("after the overnight pause, the 5 AM edition compares against midnight (no NEW flood)", async () => {
  const { readPreviousEdition } = await import("../lib/storage");
  const base = addHours(truncateToHour(new Date()), -60);
  await runHourlyIngest({ hour: base, now: addHours(base, -5 / 60), deps: deps(BASE_EVENTS) });
  const fiveHoursLater = addHours(base, 5);
  // latest.json here is a newer hour from the earlier test, so this exercises the index fallback.
  assert.equal((await readPreviousEdition(fiveHoursLater))?.key, toHourKey(base));
  assert.equal(await readPreviousEdition(addHours(base, 20)), null);
});
