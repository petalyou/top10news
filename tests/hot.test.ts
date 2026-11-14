import assert from "node:assert/strict";
import { test } from "node:test";
import type { Cluster } from "../lib/ingest/cluster";
import { pickHot } from "../lib/ingest/hot";

const now = new Date("2026-11-14T15:00:00Z");
const art = (outlet: string, tier: 1 | 2 | 3, minutesAgo: number) => ({
  outlet, tier, category: "tech" as const, title: "t", url: `https://${outlet}.x/${minutesAgo}`, teaser: "", publishedAt: new Date(now.getTime() - minutesAgo * 60_000),
});
const cluster = (arts: ReturnType<typeof art>[]): Cluster =>
  ({ id: "c", category: "tech", articles: arts, tokens: new Set(), score: 0, distinctOutlets: arts.length, newestAt: now }) as Cluster;

const surging = cluster([art("Bloomberg", 1, 10), art("NYT", 1, 20), art("Verge", 2, 30), art("Wired", 2, 40)]);
const stale = cluster([art("Bloomberg", 1, 200), art("NYT", 1, 220), art("Verge", 2, 230), art("Wired", 2, 240)]);
const smallClimber = cluster([art("Verge", 2, 10), art("Wired", 2, 20), art("Ars", 2, 30)]);

test("HOT: fast multi-outlet coverage, not NEW, at most 3 per category", () => {
  assert.deepEqual(pickHot([surging, stale], ["=", "="], now), [true, false]);
  // A NEW story shows NEW instead.
  assert.deepEqual(pickHot([surging], ["NEW"], now), [false]);
  // Climbing 3+ places with 3 fresh outlets also counts; climbing 2 doesn't.
  assert.deepEqual(pickHot([smallClimber, smallClimber], ["+3", "+2"], now), [true, false]);
  assert.deepEqual(pickHot([surging, surging, surging, surging, surging], ["=", "=", "-1", "+1", "="], now), [true, true, true, false, false]);
});
