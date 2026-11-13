import { addHours, parseHourKey, toHourKey } from "../hour";
import type { Story } from "../types";

/**
 * Freshness weighting, applied on top of the velocity score before the final Top 10 cut.
 * - A story appearing in the Top 10 for the first time gets a boost.
 * - A story keeps its full score for its first `graceHours` hours in the Top 10.
 * - After that, each extra hour multiplies its score by `decayPerHour` (never below `floor`),
 *   so a huge, still-growing story can stay high while stale ones make room for new ones.
 * Tune with env vars; defaults below.
 */
const num = (v: string | undefined, d: number) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

export const FRESHNESS = {
  newBoost: num(process.env.RANK_NEW_BOOST, 1.25),
  graceHours: num(process.env.RANK_GRACE_HOURS, 3),
  decayPerHour: num(process.env.RANK_DECAY_PER_HOUR, 0.85),
  floor: num(process.env.RANK_DECAY_FLOOR, 0.4),
};

/** Consecutive hours a story will have spent in the Top 10 if it makes this hour's list (1 = first time). */
export function hoursInTop(prev: Story | null, hourKey: string): number {
  if (!prev) return 1;
  const hour = parseHourKey(hourKey);
  const first = parseHourKey(prev.firstSeen ?? null);
  if (!hour || !first) return 2; // older files without firstSeen: at least its second hour
  return Math.max(1, Math.round((hour.getTime() - first.getTime()) / 3_600_000) + 1);
}

export function freshnessMultiplier(hours: number, cfg = FRESHNESS): number {
  if (hours <= 1) return cfg.newBoost;
  if (hours <= cfg.graceHours) return 1;
  return Math.max(cfg.floor, Math.pow(cfg.decayPerHour, hours - cfg.graceHours));
}

/** firstSeen hour key for a story in this hour's list. */
export function firstSeenFor(prev: Story | null, hourKey: string): string {
  if (!prev) return hourKey;
  if (prev.firstSeen && parseHourKey(prev.firstSeen)) return prev.firstSeen;
  const h = parseHourKey(hourKey);
  return h ? toHourKey(addHours(h, -1)) : hourKey;
}
