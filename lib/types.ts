/** Tab order; the first is the default tab. */
export const CATEGORIES = ["finance", "tech", "politics", "world"] as const;
export type Category = (typeof CATEGORIES)[number];
export const DEFAULT_CATEGORY: Category = CATEGORIES[0];

export const CATEGORY_META: Record<Category, { title: string; badge: string }> = {
  tech: { title: "Top 10 Tech & AI", badge: "Tech & AI" },
  finance: { title: "Top 10 Finance & Markets", badge: "Finance & Markets" },
  politics: { title: "Top 10 Politics", badge: "Politics" },
  world: { title: "Top 10 World", badge: "World" },
};

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

export interface StorySource {
  outlet: string;
  url: string;
  title: string;
}

export interface StoryText {
  headline: string;
  summary: string;
  whyItMatters: string;
}

/** Translations written by the hourly job. Missing languages fall back to English. */
export type StoryTranslations = Partial<Record<"es" | "zh", StoryText>>;

export interface Story {
  /** Stable per edition: "<hourKey>-<category>-<rank>" (used by bookmarks). */
  id: string;
  category: Category;
  rank: number;
  /** "NEW" (first hour in the Top 10) | "=" | "+N" | "-N" | "" (no earlier edition to compare) */
  rankChange: string;
  /** Unusually fast coverage right now (see lib/ingest/hot.ts). Never set together with NEW. */
  hot?: boolean;
  headline: string;
  summary: string;
  whyItMatters: string;
  sources: StorySource[];
  /** Identity of the underlying event across hours (carried forward by the rank diff). */
  storyKey: string;
  /** Hour key (UTC) of the first consecutive hour this story was in the Top 10. Drives freshness ranking. */
  firstSeen?: string;
  i18n?: StoryTranslations;
}

/** Story with headline/summary/whyItMatters in the reader's language (English fallback). */
export function localizeStory(story: Story, locale: "en" | "es" | "zh"): Story {
  const t = locale === "en" ? undefined : story.i18n?.[locale];
  return t ? { ...story, ...t } : story;
}

/** One immutable hourly edition, stored as snapshots/YYYY-MM-DD-HH.json. */
export interface Edition {
  /** "YYYY-MM-DD-HH" (UTC) */
  key: string;
  /** ISO timestamp of the hour, UTC */
  snapshotHour: string;
  /** When the ingest job wrote it */
  generatedAt: string;
  stories: Record<Category, Story[]>;
}
