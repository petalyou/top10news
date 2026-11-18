import { z } from "zod";
import { GEMINI_FALLBACK_MODEL, GEMINI_MODEL, generateJson } from "./gemini";
import type { Category, Story, StoryTranslations, TranslatedLocale } from "../types";

/**
 * Second-pass translation into the languages that aren't written together with the English
 * (Spanish and Chinese are; see synthesize.ts). One request per category per hour, sent one
 * after another to stay under the per-minute limit: 5 extra requests a run, about 100 a day.
 * Anything not translated simply shows in English for that language.
 */
export const EXTRA_LANGS = ["ja", "de", "fr", "ko", "pt"] as const satisfies readonly TranslatedLocale[];
type ExtraLang = (typeof EXTRA_LANGS)[number];

const LANG_GUIDE: Record<ExtraLang, string> = {
  ja: "Japanese (*_ja: natural Japanese news style, です/ます not needed in headlines)",
  de: "German (*_de: natural German news style)",
  fr: "French (*_fr: natural French news style)",
  ko: "Korean (*_ko: natural Korean news style)",
  pt: "Brazilian Portuguese (*_pt: natural Brazilian news style)",
};

const field = (lang: ExtraLang) => ({
  [`headline_${lang}`]: z.string(),
  [`summary_${lang}`]: z.string(),
  [`why_it_matters_${lang}`]: z.string(),
});

const Schema = z.object({
  stories: z.array(z.object({ id: z.string().describe("The story id exactly as given, e.g. s3"), ...Object.assign({}, ...EXTRA_LANGS.map(field)) })),
});

const SYSTEM = `You translate an hourly English news briefing. For each story (id, headline, summary, why_it_matters) return the three fields translated into:
${EXTRA_LANGS.map((l) => `- ${LANG_GUIDE[l]}`).join("\n")}
Translate faithfully and completely: add nothing, drop nothing. Keep names, numbers, tickers and currencies exact; use the commonly accepted local name for people, places and organizations where one exists, otherwise keep the original. Return one entry per id, using the ids exactly as given.`;

type Row = Record<string, string>;

function render(category: Category, stories: Story[], indices: number[]): string {
  const blocks = indices.map((i) => {
    const s = stories[i];
    return `<story id="s${i + 1}">\nheadline: ${s.headline}\nsummary: ${s.summary}\nwhy_it_matters: ${s.whyItMatters}\n</story>`;
  });
  return `Section: ${category}\nTranslate exactly ${indices.length} stories.\n\n${blocks.join("\n\n")}`;
}

function textsFrom(r: Row): StoryTranslations {
  const out: StoryTranslations = {};
  for (const lang of EXTRA_LANGS) {
    const headline = r[`headline_${lang}`]?.trim();
    const summary = r[`summary_${lang}`]?.trim();
    const whyItMatters = r[`why_it_matters_${lang}`]?.trim();
    if (headline && summary && whyItMatters) out[lang] = { headline, summary, whyItMatters };
  }
  return out;
}

/**
 * Translations for one category's published stories, by position. The fallback model is asked
 * only for stories the primary didn't return. Never throws: failures just leave English.
 */
export async function translateStories(category: Category, stories: Story[]): Promise<StoryTranslations[]> {
  const out: StoryTranslations[] = stories.map(() => ({}));
  for (const model of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]) {
    const missing = out.flatMap((t, i) => (Object.keys(t).length ? [] : [i]));
    if (!missing.length) break;
    try {
      const res = await generateJson({ model, system: SYSTEM, prompt: render(category, stories, missing), schema: Schema });
      for (const r of res.stories as Row[]) {
        const m = /(\d+)/.exec(r.id ?? "");
        const i = m ? Number(m[1]) - 1 : -1;
        if (missing.includes(i)) out[i] = textsFrom(r);
      }
    } catch (err) {
      console.warn(`[translate:${category}] ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return out;
}
