/**
 * Public read model. An edition built at :55 is already in storage, but it is
 * only shown once its hour has started, so readers see it flip at :00.
 */
import { toHourKey, truncateToHour } from "./hour";
import { readEdition, readIndex, readLatest } from "./storage";
import type { Edition } from "./types";

const currentHourKey = (now: Date) => toHourKey(truncateToHour(now));

export async function getLiveEdition(now = new Date()): Promise<Edition | null> {
  const current = currentHourKey(now);
  const latest = await readLatest(current);
  if (latest && latest.key <= current) return latest;
  // latest.json already holds the upcoming hour (written at :55): fall back to
  // the newest hour that has started.
  const index = await readIndex(current);
  const live = index.find((k) => k <= current);
  return live ? readEdition(live) : null;
}

export async function getEdition(hourKey: string, now = new Date()): Promise<Edition | null> {
  if (hourKey > currentHourKey(now)) return null; // not published yet
  return readEdition(hourKey);
}

/** Hour keys for the Time Machine dropdown, newest first. */
export async function listEditionKeys(now = new Date(), limit = 48): Promise<string[]> {
  const current = currentHourKey(now);
  return (await readIndex(current)).filter((k) => k <= current).slice(0, limit);
}
