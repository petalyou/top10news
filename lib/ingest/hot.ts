import type { Cluster } from "./cluster";

/**
 * HOT badge: a story already in the Top 10 (so not NEW) that is drawing unusually fast coverage.
 * Hot when, within the last 90 minutes, at least 4 different outlets covered it including 2
 * tier-1 newsrooms, or it climbed 3+ places with 3+ outlets covering it in that window.
 * At most 3 per category, highest-ranked first.
 */
export const HOT = {
  windowMinutes: 90,
  minFreshOutlets: 4,
  minFreshTier1: 2,
  climbPlaces: 3,
  climbMinFreshOutlets: 3,
  maxPerCategory: 3,
};

export function freshCoverage(c: Cluster, now: Date): { outlets: number; tier1: number } {
  const outlets = new Set<string>();
  const tier1 = new Set<string>();
  for (const a of c.articles) {
    if ((now.getTime() - a.publishedAt.getTime()) / 60_000 > HOT.windowMinutes) continue;
    outlets.add(a.outlet);
    if (a.tier === 1) tier1.add(a.outlet);
  }
  return { outlets: outlets.size, tier1: tier1.size };
}

/** `ranked` in final order; `rankChanges` as stored ("NEW", "=", "+N", "-N" or ""). */
export function pickHot(ranked: Cluster[], rankChanges: string[], now: Date): boolean[] {
  let left = HOT.maxPerCategory;
  return ranked.map((c, i) => {
    const change = rankChanges[i];
    if (left <= 0 || change === "NEW") return false;
    const { outlets, tier1 } = freshCoverage(c, now);
    const climbed = change.startsWith("+") ? Number(change.slice(1)) : 0;
    const hot =
      (outlets >= HOT.minFreshOutlets && tier1 >= HOT.minFreshTier1) ||
      (climbed >= HOT.climbPlaces && outlets >= HOT.climbMinFreshOutlets);
    if (hot) left--;
    return hot;
  });
}
