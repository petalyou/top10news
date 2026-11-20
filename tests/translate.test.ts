/** Japanese, German, French, Korean and Portuguese come from one extra request per tab. */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const dir = await mkdtemp(path.join(tmpdir(), "top10-tr-"));
process.env.LOCAL_DATA_DIR = dir;
process.env.GEMINI_API_KEY = "k";
const { translateStories, EXTRA_LANGS } = await import("../lib/ingest/translate");
const { runHourlyIngest } = await import("../lib/ingest/pipeline");
const { readEditionUncached } = await import("../lib/storage");
const { addHours, toHourKey, truncateToHour } = await import("../lib/hour");
const { localizeStory } = await import("../lib/types");
const { getDictionary, LOCALES } = await import("../lib/i18n");
const { articlesFor, BASE_EVENTS } = await import("./fixtures");
after(() => rm(dir, { recursive: true, force: true }));

const story = (i: number) => ({ id: `k-tech-${i}`, category: "tech", rank: i, rankChange: "", headline: `H${i}`, summary: "S.", whyItMatters: "W.", sources: [], storyKey: `${i}` }) as never;
const row = (id: string) => Object.assign({ id }, ...EXTRA_LANGS.map((l) => ({ [`headline_${l}`]: `${l} ${id}`, [`summary_${l}`]: "s", [`why_it_matters_${l}`]: "w" })));
const reply = (stories: unknown[]) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ stories }) }] }, finishReason: "STOP" }] }));

test("translation keeps what the primary wrote and asks the fallback only for the rest", async () => {
  const prompts: string[] = [];
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (_u: string, init: RequestInit) => {
      prompts.push(JSON.parse(String(init.body)).contents[0].parts[0].text);
      return prompts.length === 1 ? reply([row("s1")]) : reply([row("s2")]);
    }) as typeof fetch;
    const out = await translateStories("tech", [story(1), story(2)]);
    assert.equal(out[0].ja?.headline, "ja s1");
    assert.equal(out[1].pt?.headline, "pt s2");
    assert.equal(prompts.length, 2);
    assert.doesNotMatch(prompts[1], /id="s1"/);

    // Total failure: no throw, English stays.
    globalThis.fetch = (async () => new Response("bad", { status: 400 })) as unknown as typeof fetch;
    const none = await translateStories("tech", [story(1)]);
    assert.deepEqual(none, [{}]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the hourly run adds the new languages next to Spanish and Chinese", async () => {
  const synth = async (_c: unknown, list: { articles: { title: string }[] }[]) =>
    list.map((c) => ({ headline: c.articles[0].title, summary: "S.", whyItMatters: "W.", i18n: { es: { headline: "es", summary: "s", whyItMatters: "w" } } }));
  const calls: string[] = [];
  const h = addHours(truncateToHour(new Date()), -30);
  await runHourlyIngest({
    hour: h,
    now: addHours(h, -5 / 60),
    deps: {
      fetch: async (n = new Date()) => ({ articles: articlesFor(BASE_EVENTS, n), feedErrors: [] }),
      synthesize: synth as never,
      dedupe: async () => ({ groups: [], categories: {} }),
      translate: async (c, stories) => {
        calls.push(c);
        return stories.map((s) => ({ de: { headline: `DE ${s.headline}`, summary: "s", whyItMatters: "w" } }));
      },
    },
  });
  const e = (await readEditionUncached(toHourKey(h)))!;
  const s = e.stories.tech[0];
  assert.equal(localizeStory(s, "de").headline, `DE ${s.headline}`);
  assert.equal(localizeStory(s, "es").headline, "es");
  assert.equal(localizeStory(s, "ko").headline, s.headline); // not translated -> English
  assert.equal(new Set(calls).size, calls.length); // one request per tab
});

test("every language has a complete interface dictionary", () => {
  const keys = (o: object) => Object.keys(o).sort();
  for (const l of LOCALES) assert.deepEqual(keys(getDictionary(l)), keys(getDictionary("en")), l);
});

test("the first-visit tooltip offers the first supported browser language", async () => {
  const { preferredLocale } = await import("../lib/i18n");
  assert.equal(preferredLocale(["pt-BR", "en-US"]), "pt");
  assert.equal(preferredLocale(["it-IT", "zh-TW", "en"]), "zh");
  assert.equal(preferredLocale(["it-IT"]), null);
});
