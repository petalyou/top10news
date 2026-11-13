import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CATEGORY_META, type Category, type StoryTranslations } from "../types";
import type { Cluster } from "./cluster";

export interface Synthesis {
  headline: string;
  summary: string;
  whyItMatters: string;
  i18n?: StoryTranslations;
}

const PRIMARY_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const FALLBACK_MODEL = process.env.ANTHROPIC_FALLBACK_MODEL || "claude-sonnet-5-5";

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
- Return one entry per cluster id, using the ids exactly as given.`;

function renderClusters(category: Category, clusters: Cluster[]): string {
  const blocks = clusters.map((c, i) => {
    const lines = c.articles
      .slice(0, 6)
      .map((a) => `  - [${a.outlet}] ${a.title}${a.teaser ? ` — ${a.teaser.slice(0, 280)}` : ""}`);
    return `<cluster id="c${i + 1}">\n${lines.join("\n")}\n</cluster>`;
  });
  return `Category: ${CATEGORY_META[category].badge}\n\n${blocks.join("\n\n")}`;
}

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

async function callModel(model: string, prompt: string) {
  const isHaiku = model.startsWith("claude-haiku");
  const response = await anthropic().beta.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    output_config: { effort: "low", format: betaZodOutputFormat(OutputSchema) },
    // Server-side refusal fallback where supported (not available for Haiku).
    ...(isHaiku ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
  });
  if (response.stop_reason === "refusal") {
    throw new Error(`refusal (${response.stop_details?.category ?? "uncategorized"}) from ${model}`);
  }
  if (response.stop_reason === "max_tokens") throw new Error(`max_tokens reached on ${model}`);
  if (!response.parsed_output) throw new Error(`unparseable output from ${model}`);
  return response.parsed_output;
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
 * Tries the primary model, then the fallback model. Throws if both fail so the
 * hour is not published with partial content.
 */
export async function synthesizeCategory(category: Category, clusters: Cluster[]): Promise<Synthesis[]> {
  if (clusters.length === 0) return [];
  const prompt = renderClusters(category, clusters);

  let lastErr: unknown;
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      const out = await callModel(model, prompt);
      const byId = new Map(out.stories.map((s) => [s.id.trim(), s]));
      const result = clusters.map((_, i) => byId.get(`c${i + 1}`));
      if (result.some((r) => !r || !r.headline.trim() || !r.summary.trim() || !r.why_it_matters.trim())) {
        throw new Error(`incomplete output from ${model}`);
      }
      return result.map((r) => ({
        headline: r!.headline.trim(),
        summary: r!.summary.trim(),
        whyItMatters: r!.why_it_matters.trim(),
        i18n: translationsFrom(r!),
      }));
    } catch (err) {
      lastErr = err;
      console.warn(`[synthesize:${category}] ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ---------------------------------------------------------------------------
// Duplicate-event pass: catches same-story clusters that lexical matching missed
// ---------------------------------------------------------------------------

const DedupeSchema = z.object({
  groups: z.array(z.array(z.string())).describe("Each inner list holds 2+ ids that report the same underlying event"),
});

const DEDUPE_SYSTEM = `You deduplicate news story clusters. Each cluster has an id and the headlines that fell into it.
Group together clusters that report the SAME underlying event (same incident, announcement, decision or market move), even when worded differently.
Do not group stories that are merely related (e.g. a company's earnings and a separate lawsuit against it). Only output groups of two or more ids; omit clusters that stand alone.`;

/**
 * Returns groups of cluster ids that describe the same event. Non-fatal: on any
 * failure it returns [] and the pipeline continues with lexical clusters.
 */
export async function findDuplicateGroups(category: Category, clusters: Cluster[]): Promise<string[][]> {
  if (clusters.length < 2) return [];
  const prompt = clusters
    .map((c) => `<cluster id="${c.id}">\n${c.articles.slice(0, 4).map((a) => `  - ${a.title}`).join("\n")}\n</cluster>`)
    .join("\n");
  try {
    const response = await anthropic().beta.messages.parse({
      model: PRIMARY_MODEL,
      max_tokens: 4000,
      system: DEDUPE_SYSTEM,
      messages: [{ role: "user", content: `Category: ${CATEGORY_META[category].badge}\n\n${prompt}` }],
      output_config: { effort: "low", format: betaZodOutputFormat(DedupeSchema) },
    });
    if (response.stop_reason !== "end_turn" || !response.parsed_output) return [];
    const valid = new Set(clusters.map((c) => c.id));
    return response.parsed_output.groups.map((g) => g.filter((id) => valid.has(id))).filter((g) => g.length >= 2);
  } catch (err) {
    console.warn(`[dedupe:${category}] skipped:`, err instanceof Error ? err.message : err);
    return [];
  }
}
