/**
 * Sponsors come from the static data/sponsors.json file (no database).
 * Editorial rankings never read this file.
 */
import { z } from "zod";
import file from "@/data/sponsors.json";
import { localDateParts } from "./hour";
import type { Locale } from "./i18n";
import { CATEGORIES, type Category } from "./types";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const SponsorTextSchema = z.object({
  headline: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  why_it_matters: z.string().nullable().optional(),
  cta_label: z.string().min(1).optional(),
});

export const SponsorSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["tech", "finance", "politics", "world", "health", "all"]),
  slot_type: z.enum(["title_banner", "native_briefing"]),
  sponsor_name: z.string().min(1),
  headline: z.string().min(1),
  summary: z.string().min(1),
  why_it_matters: z.string().nullable().optional(),
  cta_label: z.string().min(1).default("Learn More →"),
  target_url: z.string().regex(/^https?:\/\//),
  start_date: DATE,
  end_date: DATE,
  is_active: z.boolean().default(true),
  /** Optional translations; any field left out falls back to English. */
  i18n: z
    .object({
      es: SponsorTextSchema.optional(),
      zh: SponsorTextSchema.optional(),
      ja: SponsorTextSchema.optional(),
      de: SponsorTextSchema.optional(),
      fr: SponsorTextSchema.optional(),
      ko: SponsorTextSchema.optional(),
      pt: SponsorTextSchema.optional(),
    })
    .optional(),
});

export type SponsorRecord = z.infer<typeof SponsorSchema>;

export interface Sponsor {
  id: string;
  sponsorName: string;
  headline: string;
  summary: string;
  whyItMatters: string | null;
  ctaLabel: string;
  targetUrl: string;
}

export interface ActiveSponsors {
  titleBanner: Sponsor | null;
  nativeBriefing: Sponsor | null;
}

/** Valid records from the file; malformed entries are skipped with a warning. */
export function loadSponsors(raw: unknown = file): SponsorRecord[] {
  const list = (raw as { sponsors?: unknown[] })?.sponsors ?? [];
  const out: SponsorRecord[] = [];
  list.forEach((entry, i) => {
    const parsed = SponsorSchema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
    else console.warn(`[sponsors] skipping entry ${i}:`, parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "));
  });
  return out;
}

const toSponsor = (r: SponsorRecord, locale: Locale): Sponsor => {
  const t = locale === "en" ? undefined : r.i18n?.[locale];
  return {
    id: r.id,
    sponsorName: r.sponsor_name,
    headline: t?.headline ?? r.headline,
    summary: t?.summary ?? r.summary,
    whyItMatters: (t?.why_it_matters !== undefined ? t.why_it_matters : r.why_it_matters) ?? null,
    ctaLabel: t?.cta_label ?? r.cta_label,
    targetUrl: r.target_url,
  };
};

function pick(records: SponsorRecord[], slot: SponsorRecord["slot_type"], category: Category, date: string, locale: Locale): Sponsor | null {
  const live = records.filter((r) => r.is_active && r.slot_type === slot && r.start_date <= date && date <= r.end_date);
  const best =
    live.filter((r) => r.category === category).sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ??
    live.filter((r) => r.category === "all").sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  return best ? toSponsor(best, locale) : null;
}

export function getActiveSponsors(category: Category, date = localDateParts(new Date()).date, records = loadSponsors(), locale: Locale = "en"): ActiveSponsors {
  return {
    titleBanner: pick(records, "title_banner", category, date, locale),
    nativeBriefing: pick(records, "native_briefing", category, date, locale),
  };
}

export function getAllActiveSponsors(locale: Locale = "en", date = localDateParts(new Date()).date): Record<Category, ActiveSponsors> {
  const records = loadSponsors();
  return Object.fromEntries(CATEGORIES.map((c) => [c, getActiveSponsors(c, date, records, locale)])) as Record<Category, ActiveSponsors>;
}
