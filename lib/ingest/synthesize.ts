import { z } from "zod";
import { GEMINI_FALLBACK_MODEL, GEMINI_MODEL, generateJson } from "./gemini";
import { CATEGORY_META, type Category, type StoryTranslations } from "../types";
import type { Cluster } from "./cluster";

export interface Synthesis {
  headline: string;
  summary: string;
  whyItMatters: string;
  i18n?: StoryTranslations;
  /** Index (in the category's list) of another story Gemini says reports the very same event. */
  sameAs?: number;
}

/**
 * Gemini request budget per hourly run: 1 duplicate check (all categories at once) + 1 write-up
 * per category = 5 requests, about 100 a day over the 20 daily editions. Flash-Lite's free tier
 * allows ~500 a day; the fallback model (also Flash-Lite) is only used when the primary fails.
 */
const PRIMARY_MODEL = GEMINI_MODEL;
const FALLBACK_MODEL = GEMINI_FALLBACK_MODEL;

const OutputSchema = z.object({
  stories: z.array(
    z.object({
      id: z.string().describe("The cluster id exactly as given, e.g. c3"),
      headline: z.string().describe("Neutral, punchy headline, max ~90 characters, no clickbait"),
      summary: z.string().describe("Exactly two original factual sentences"),
      why_it_matters: z.string().describe("One concise analytical sentence"),
      headline_es: z.string().describe("Spanish translation of headline"),
      summary_es: z.string().describe("Spanish translation of summary"),
      why_it_matters_es: z.string().describe("Spanish translation of why_it_matters"),
      headline_zh: z.string().describe("Simplified Chinese translation of headline"),
      summary_zh: z.string().describe("Simplified Chinese translation of summary"),
      why_it_matters_zh: z.string().describe("Simplified Chinese translation of why_it_matters"),
      same_event_as: z.string().default("").describe('Id of another cluster in this list that reports the very same event, or "" if none'),
    }),
  ),
});

const SYSTEM = `You are the desk editor of Top 10 News Hourly, a finite, non-sensational news briefing.
For each story cluster you receive (headlines and short teasers from several publishers), write:
- headline: a neutral, specific, punchy headline in your own words (no clickbait, no ALL CAPS, no trailing period, at most ~90 characters).
- summary: exactly two sentences that synthesize what the sources collectively report, written entirely in your own words. Never copy a phrase of more than five consecutive words from any source. Attribute contested claims ("according to ...").
- why_it_matters: one concise analytical sentence on the significance or consequence for readers.
- The same three fields translated into Spanish (*_es: natural, neutral international Spanish) and Simplified Chinese (*_zh: natural Mainland news style, 简体中文). Translate faithfully; keep names, numbers and tickers exact; use the commonly accepted local name for people and organizations where one exists, otherwise keep the original.

Rules:
- Use only facts present in the provided material. Do not invent numbers, names, quotes or outcomes. If the material is thin, stay general rather than guess.
- Keep a neutral, non-partisan tone; describe political claims as claims.
- If a cluster mixes an earlier event with a newer development about it, lead with the newest development.
- same_event_as: if this cluster reports the very same event as another cluster in the list (same incident, launch, announcement or decision, just worded differently or from other outlets), give that cluster's id; otherwise "". A follow-up development is NOT the same event: reactions, petitions, support or backlash, investigations, a successor being named, or market fallout after the news each count as their own story.
- Return one entry per cluster id, using the ids exactly as given.`;

/** Clusters are numbered by their position in the full ranked list (c1..c10), even in a partial retry. */
function renderClusters(category: Category, clusters: Cluster[], indices: number[]): string {
  const blocks = indices.map((i) => {
    const lines = clusters[i].articles
      .slice(0, 6)
      .map((a) => `  - [${a.outlet}] ${a.title}${a.teaser ? ` — ${a.teaser.slice(0, 280)}` : ""}`);
    return `<cluster id="c${i + 1}">\n${lines.join("\n")}\n</cluster>`;
  });
  return `Category: ${CATEGORY_META[category].badge}\nWrite exactly ${indices.length} entries, one for each cluster id below.\n\n${blocks.join("\n\n")}`;
}

/** "c3", "C3", "3", "c03", "cluster 3" -> index 2. */
function indexFromId(id: string): number | null {
  const m = /(\d+)/.exec(id);
  return m ? Number(m[1]) - 1 : null;
}

async function callModel(model: string, prompt: string) {
  return generateJson({ model, system: SYSTEM, prompt, schema: OutputSchema });
}

type OutputStory = z.infer<typeof OutputSchema>["stories"][number];

/** Keeps a language only if all three of its fields came back non-empty. */
function translationsFrom(r: OutputStory): StoryTranslations {
  const out: StoryTranslations = {};
  for (const lang of ["es", "zh"] as const) {
    const headline = r[`headline_${lang}`]?.trim();
    const summary = r[`summary_${lang}`]?.trim();
    const whyItMatters = r[`why_it_matters_${lang}`]?.trim();
    if (headline && summary && whyItMatters) out[lang] = { headline, summary, whyItMatters };
  }
  return out;
}

/**
 * Write headline / 2-sentence summary / why-it-matters for one category's ranked clusters.
 * Accepts partial answers: whatever the primary model got right is kept, and only the missing
 * stories go to the fallback model (still at most 2 requests per category). Returns null for a
 * story neither model wrote; the pipeline then leaves that story out.
 */
export async function synthesizeCategory(category: Category, clusters: Cluster[]): Promise<(Synthesis | null)[]> {
  const out: (Synthesis | null)[] = clusters.map(() => null);
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    const missing = out.flatMap((r, i) => (r ? [] : [i]));
    if (!missing.length) break;
    try {
      const res = await callModel(model, renderClusters(category, clusters, missing));
      for (const r of res.stories) {
        const i = indexFromId(r.id);
        if (i == null || !missing.includes(i) || out[i]) continue;
        if (!r.headline.trim() || !r.summary.trim() || !r.why_it_matters.trim()) continue;
        const same = r.same_event_as?.trim() ? indexFromId(r.same_event_as) : null;
        out[i] = {
          headline: r.headline.trim(),
          summary: r.summary.trim(),
          whyItMatters: r.why_it_matters.trim(),
          i18n: translationsFrom(r),
          ...(same != null && same !== i && same >= 0 && same < clusters.length ? { sameAs: same } : {}),
        };
      }
      const still = out.filter((r) => !r).length;
      if (still) console.warn(`[synthesize:${category}] ${model} left ${still} of ${missing.length} stories unwritten`);
    } catch (err) {
      console.warn(`[synthesize:${category}] ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Duplicate-event pass: catches same-story clusters that lexical matching missed
// ---------------------------------------------------------------------------

const TOPICS = ["tech", "finance", "politics", "world", "other"] as const;
export type Topic = (typeof TOPICS)[number];

const DedupeSchema = z.object({
  groups: z.array(z.array(z.string())).describe("Each inner list holds 2+ ids that report the same underlying event"),
  categories: z
    .array(z.object({ id: z.string(), category: z.enum(TOPICS) }))
    .describe("One entry per cluster id: the section the story belongs in, judged by its content"),
});

const DEDUPE_SYSTEM = `You are the desk editor sorting news story clusters for an hourly Top 10 briefing. Each cluster has an id and the headlines that fell into it. Clusters are listed under the section of the feed they came from, which is often wrong for general feeds.

Task 1 - categories: for EVERY cluster id, decide the section by what the story is about:
- tech: technology, AI, software, gadgets, internet platforms' products, cybersecurity, science and space (e.g. rocket launches, NASA, SpaceX missions).
- finance: markets, the economy, company business news and earnings, deals, jobs data, central banks, crypto.
- politics: United States government and politics: Congress, the White House, elections, courts, federal and state policy.
- world: international affairs and other countries' news: diplomacy, wars, foreign governments and elections, global disasters.
- other: anything else (sports, entertainment, celebrity, lifestyle, weather, local crime). These are left out of the briefing.
When a story fits two sections, pick the one a reader would look in first (a US tariff vote is politics; its market reaction is finance).

Task 2 - duplicates: group together clusters that report the SAME underlying event (same incident, announcement, decision or market move), even when worded differently, and only when you put them in the same section. Do not group stories that are merely related (e.g. a company's earnings and a separate lawsuit against it). A follow-up development is a separate event: reactions, petitions, support or backlash, investigations, a successor being named, or market fallout after the original news each stay in their own cluster, even though they share the same people and company. Only output groups of two or more ids.`;

export interface DeskResult {
  /** Same-event groups (2+ ids, same final category). */
  groups: string[][];
  /** Content-based section per cluster id; "other" means leave it out. */
  categories: Record<string, Topic>;
}

/**
 * One request for the whole hour: re-files every candidate cluster by content (feeds like BBC's
 * US & Canada page mix politics with science and sport) and finds same-event duplicates.
 * Non-fatal: on any failure it returns nothing and the pipeline keeps feed categories and
 * lexical clusters.
 */
export async function findDuplicateGroups(byCategory: Partial<Record<Category, Cluster[]>>): Promise<DeskResult> {
  const entries = (Object.entries(byCategory) as [Category, Cluster[]][]).filter(([, cl]) => cl.length > 0);
  if (!entries.length) return { groups: [], categories: {} };
  const prompt = entries
    .map(
      ([category, clusters]) =>
        `Feed section: ${CATEGORY_META[category].badge}\n` +
        clusters.map((c) => `<cluster id="${c.id}">\n${c.articles.slice(0, 4).map((a) => `  - [${a.outlet}] ${a.title}`).join("\n")}\n</cluster>`).join("\n"),
    )
    .join("\n\n");
  try {
    const out = await generateJson({ model: PRIMARY_MODEL, system: DEDUPE_SYSTEM, prompt, schema: DedupeSchema, maxOutputTokens: 12_000 });
    const feedCategory = new Map(entries.flatMap(([cat, cl]) => cl.map((c) => [c.id, cat as Topic] as const)));
    const categories: Record<string, Topic> = {};
    for (const { id, category } of out.categories) if (feedCategory.has(id)) categories[id] = category;
    const finalOf = (id: string) => categories[id] ?? feedCategory.get(id);
    const groups = out.groups
      .map((g) => [...new Set(g)].filter((id) => feedCategory.has(id)))
      .filter((g) => g.length >= 2 && finalOf(g[0]) !== "other" && g.every((id) => finalOf(id) === finalOf(g[0])));
    return { groups, categories };
  } catch (err) {
    console.warn("[desk] skipped:", err instanceof Error ? err.message : err);
    return { groups: [], categories: {} };
  }
}
