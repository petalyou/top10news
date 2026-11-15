/**
 * Snapshot-hour helpers. Snapshot keys in URLs are UTC: ?t=YYYY-MM-DD-HH.
 * Display formatting uses the configured site time zone.
 */

/**
 * Readers see times in their own zone (formatted in the browser). This zone is only the
 * server-rendered fallback shown before the page hydrates.
 */
export const DISPLAY_TZ = process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE || "America/New_York";

/** The zone the publishing schedule follows. */
export const EDITION_TZ = process.env.EDITION_TIMEZONE || "America/New_York";

/**
 * Publishing day, in EDITION_TZ: the first edition is 5 AM and the last is
 * 12 AM (midnight). No editions between 1 AM and 4 AM. Hours are 0-23.
 */
export const FIRST_EDITION_HOUR = 5;
export const LAST_EDITION_HOUR = 0;

/** True when an edition is published for the hour starting at `d`. */
export function isEditionHour(d: Date, tz = EDITION_TZ): boolean {
  const h = localDateParts(d, tz).hour;
  return FIRST_EDITION_HOUR <= LAST_EDITION_HOUR
    ? h >= FIRST_EDITION_HOUR && h <= LAST_EDITION_HOUR
    : h >= FIRST_EDITION_HOUR || h <= LAST_EDITION_HOUR;
}

/** The next edition time strictly after `now`. */
export function nextEditionTime(now: Date, tz = EDITION_TZ): Date {
  let t = addHours(truncateToHour(now), 1);
  for (let i = 0; i < 48 && !isEditionHour(t, tz); i++) t = addHours(t, 1);
  return t;
}

export function truncateToHour(d: Date): Date {
  const t = new Date(d);
  t.setUTCMinutes(0, 0, 0);
  return t;
}

export function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3_600_000);
}

/** Date -> "YYYY-MM-DD-HH" in UTC. */
export function toHourKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${p(d.getUTCHours())}`;
}

/** "YYYY-MM-DD-HH" (UTC) -> Date, or null when malformed. */
export function parseHourKey(key: string | null | undefined): Date | null {
  if (!key) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [, y, mo, d, h] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, h));
  // Reject rollovers such as 2026-02-31.
  return toHourKey(date) === key ? date : null;
}

type Lang = "en" | "es" | "zh";
const TAG: Record<Lang, string> = { en: "en-US", es: "es-ES", zh: "zh-CN" };

/** A time zone, or `null` for the viewer's own zone (use only in the browser). */
type Zone = string | null;

const fmt = (lang: Lang, tz: Zone, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(TAG[lang], { ...(tz ? { timeZone: tz } : {}), ...opts });

/** Short zone name ("EST", "PST", "GMT+8"), US-style in every language since readers recognise it. */
function zoneAbbr(d: Date, tz: Zone): string {
  return fmt("en", tz, { timeZoneName: "short" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** "2:00 PM EST" / "14:00 EST" / "14:00 EST" */
export function formatTimeLabel(d: Date, lang: Lang = "en", tz: Zone = DISPLAY_TZ): string {
  const time = fmt(lang, tz, { hour: "numeric", minute: "2-digit", hourCycle: lang === "en" ? "h12" : "h23" }).format(d);
  return `${time} ${zoneAbbr(d, tz)}`;
}

/** "Nov 12, 2026 · 2:00 PM EST" */
export function formatOptionLabel(d: Date, lang: Lang = "en", tz: Zone = DISPLAY_TZ): string {
  const date = fmt(lang, tz, { month: "short", day: "numeric", year: "numeric" }).format(d);
  return `${date} · ${formatTimeLabel(d, lang, tz)}`;
}

/** "Thursday, Nov 12, 2026 at 2:00 PM EST" / "jueves, 12 nov 2026, 14:00 EST" / "2026年11月12日星期四 14:00 EST" */
export function formatFullDate(d: Date, lang: Lang = "en", tz: Zone = DISPLAY_TZ): string {
  const date = fmt(lang, tz, { weekday: "long", month: lang === "zh" ? "long" : "short", day: "numeric", year: "numeric" }).format(d);
  const joiner = lang === "en" ? " at " : lang === "es" ? ", " : " ";
  return `${date}${joiner}${formatTimeLabel(d, lang, tz)}`;
}

/** Calendar date (YYYY-MM-DD) and hour (0-23) of `d` in the display zone. */
export function localDateParts(d: Date, tz = DISPLAY_TZ): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/**
 * The publishing day's first and last edition as instants (the next ones from `now`), so they
 * can be shown in any zone.
 */
export function editionWindow(now: Date, tz = EDITION_TZ): { first: Date; last: Date } {
  let first = truncateToHour(now);
  for (let i = 0; i < 48 && localDateParts(first, tz).hour !== FIRST_EDITION_HOUR; i++) first = addHours(first, 1);
  let last = first;
  for (let i = 0; i < 48 && localDateParts(last, tz).hour !== LAST_EDITION_HOUR; i++) last = addHours(last, 1);
  return { first, last };
}

/** "5 AM–12 AM EST" / "5:00–0:00 EST": the publishing hours in `tz` (null = the viewer's zone). */
export function formatEditionWindow(now: Date, lang: Lang = "en", tz: Zone = DISPLAY_TZ): string {
  const { first, last } = editionWindow(now);
  const f = fmt(lang, tz, lang === "en" ? { hour: "numeric", hourCycle: "h12" } : { hour: "numeric", minute: "2-digit", hourCycle: "h23" });
  return `${f.format(first)}–${f.format(last)} ${zoneAbbr(first, tz)}`;
}
