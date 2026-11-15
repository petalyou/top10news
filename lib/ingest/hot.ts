import type { Cluster } from "./cluster";

/**
 * HOT badge: a story already in the Top 10 (so not NEW) that is drawing unusually fast coverage.
 *
 * 1. Surge (absolute): within the last 90 minutes, 4+ different outlets covered it including 2
 *    tier-1 newsrooms, or it climbed 3+ places with 3+ outlets covering it in that window.
 *    A story that is trending on Google searches also counts once 2+ outlets covered it in the
 *    last 2 hours. A story matching one of Google's top 3 searches is HOT outright, even with one
 *    outlet and even in its first hour (HOT is then shown instead of NEW).
 * 1b. Staying power: a story in the top 3 for a second edition in a row (it was top 3 last hour
 *    and still is) is HOT.
 * 2. Clear leader (relative): real feeds rarely hit the surge bar on a quiet hour, so when no story
 *    in a category surges, the one with the fastest recent coverage is HOT if it clearly leads the
 *    rest of the list (see `velocity`). At most one per category this way.
 *
 * At most 3 per category, highest-ranked first.
 */
export const HOT = {
  windowMinutes: 90,
  minFreshOutlets: 4,
  minFreshTier1: 2,
  climbPlaces: 3,
  climbMinFreshOutlets: 3,
  maxPerCategory: 3,
  persistTop: 3,
  topTrends: 3,
  leaderWindowMinutes: 120,
  leaderMinOutlets: 2,
  leaderMinVelocity: 3,
  leaderMargin: 1,
};

export function freshCoverage(c: Cluster, now: Date, windowMinutes = HOT.windowMinutes): { outlets: number; tier1: number } {
  const outlets = new Set<string>();
  const tier1 = new Set<string>();
  for (const a of c.articles) {
    if ((now.getTime() - a.publishedAt.getTime()) / 60_000 > windowMinutes) continue;
    outlets.add(a.outlet);
    if (a.tier === 1) tier1.add(a.outlet);
  }
  return { outlets: outlets.size, tier1: tier1.size };
}

const climbOf = (change: string) => (change.startsWith("+") ? Number(change.slice(1)) : 0);

/** Recent-coverage speed: outlets in the last 2h, half a point per tier-1 newsroom, +1 for climbing 2+ places. */
export function velocity(c: Cluster, change: string, now: Date): { score: number; outlets: number } {
  const { outlets, tier1 } = freshCoverage(c, now, HOT.leaderWindowMinutes);
  return { score: outlets + 0.5 * tier1 + (climbOf(change) >= 2 ? 1 : 0), outlets };
}

/** `ranked` in final order; `trendRanks[i]` the story's position on Google's trending list (1 = top), or null; `prevRanks[i]` its rank last edition; `rankChanges` as stored ("NEW", "=", "+N", "-N" or ""). */
export function pickHot(ranked: Cluster[], rankChanges: string[], now: Date, trendRanks: (number | null)[] = [], prevRanks: (number | null)[] = []): boolean[] {
  let left = HOT.maxPerCategory;
  const hot = ranked.map((c, i) => {
    const change = rankChanges[i];
    if (left <= 0) return false;
    const topTrend = trendRanks[i] != null && trendRanks[i]! <= HOT.topTrends;
    if (topTrend) {
      left--;
      return true;
    }
    if (change === "NEW") return false;
    const { outlets, tier1 } = freshCoverage(c, now);
    const surge =
      (outlets >= HOT.minFreshOutlets && tier1 >= HOT.minFreshTier1) ||
      (climbOf(change) >= HOT.climbPlaces && outlets >= HOT.climbMinFreshOutlets) ||
      (trendRanks[i] != null && freshCoverage(c, now, HOT.leaderWindowMinutes).outlets >= HOT.leaderMinOutlets) ||
      (i + 1 <= HOT.persistTop && prevRanks[i] != null && prevRanks[i]! <= HOT.persistTop);
    if (surge) left--;
    return surge;
  });
  if (hot.some(Boolean)) return hot;

  // Quiet hour: flag the clear leader, if there is one.
  const v = ranked.map((c, i) => (rankChanges[i] === "NEW" ? null : velocity(c, rankChanges[i], now)));
  const order = v.map((x, i) => ({ x, i })).filter((e) => e.x).sort((a, b) => b.x!.score - a.x!.score || a.i - b.i);
  const [first, second] = order;
  if (
    first &&
    first.x!.outlets >= HOT.leaderMinOutlets &&
    first.x!.score >= HOT.leaderMinVelocity &&
    first.x!.score - (second?.x!.score ?? 0) >= HOT.leaderMargin
  ) {
    hot[first.i] = true;
  }
  return hot;
}
