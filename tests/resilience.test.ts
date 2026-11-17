/** One category's bad Gemini answer must never block the hour. */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const dir = await mkdtemp(path.join(tmpdir(), "top10-res-"));
process.env.LOCAL_DATA_DIR = dir;
process.env.GEMINI_API_KEY = "k";
const { runHourlyIngest } = await import("../lib/ingest/pipeline");
const { synthesizeCategory } = await import("../lib/ingest/synthesize");
const { readEditionUncached, editionExists } = await import("../lib/storage");
const { addHours, toHourKey, truncateToHour } = await import("../lib/hour");
const { articlesFor, BASE_EVENTS } = await import("./fixtures");
after(() => rm(dir, { recursive: true, force: true }));

const entry = (id: string) => ({
  id, headline: `H ${id}`, summary: "One. Two.", why_it_matters: "W.",
  headline_es: "", summary_es: "", why_it_matters_es: "", headline_zh: "", summary_zh: "", why_it_matters_zh: "",
});
const reply = (stories: unknown[]) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ stories }) }] }, finishReason: "STOP" }] }));
const cl = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `x${i}`, category: "finance", articles: [{ outlet: "Bloomberg", title: `Story ${i}`, teaser: "" }] })) as never;

test("synthesis keeps partial answers and asks the fallback only for the missing stories", async () => {
  const prompts: string[] = [];
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (_u: string, init: RequestInit) => {
      const prompt = JSON.parse(String(init.body)).contents[0].parts[0].text as string;
      prompts.push(prompt);
      // Primary: odd id styles, skips story 3. Fallback: writes it.
      return prompts.length === 1 ? reply([entry("c1"), entry("C2"), entry("4")]) : reply([entry("c3")]);
    }) as typeof fetch;
    const out = await synthesizeCategory("finance", cl(4));
    assert.deepEqual(out.map((o) => o?.headline), ["H c1", "H C2", "H c3", "H 4"]);
    assert.equal(prompts.length, 2);
    assert.match(prompts[1], /id="c3"/);
    assert.doesNotMatch(prompts[1], /id="c1"/);

    // Neither model writes story 2 -> null, the rest are kept.
    prompts.length = 0;
    globalThis.fetch = (async () => reply([entry("c1")])) as unknown as typeof fetch;
    const partial = await synthesizeCategory("finance", cl(2));
    assert.equal(partial[0]?.headline, "H c1");
    assert.equal(partial[1], null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a failed category keeps the previous list; other categories still publish", async () => {
  const synthOk = async (_c: unknown, list: { articles: { title: string }[] }[]) => list.map((c) => ({ headline: c.articles[0].title, summary: "S.", whyItMatters: "W." }));
  const deps = (synth: unknown) => ({
    fetch: async (n = new Date()) => ({ articles: articlesFor(BASE_EVENTS, n), feedErrors: [] }),
    synthesize: synth as never,
    dedupe: async () => ({ groups: [], categories: {} }),
  });
  const h0 = addHours(truncateToHour(new Date()), -6);
  await runHourlyIngest({ hour: h0, now: addHours(h0, -5 / 60), deps: deps(synthOk) });

  const h1 = addHours(h0, 1);
  const financeFails = async (c: string, list: { articles: { title: string }[] }[]) => {
    if (c === "finance") throw new Error("incomplete output");
    return synthOk(c, list);
  };
  const r = await runHourlyIngest({ hour: h1, now: addHours(h1, -5 / 60), deps: deps(financeFails) });
  assert.equal(r.status, "published");
  assert.deepEqual(r.fallbackCategories, ["finance"]);
  const e0 = (await readEditionUncached(toHourKey(h0)))!;
  const e1 = (await readEditionUncached(toHourKey(h1)))!;
  assert.deepEqual(e1.stories.finance.map((s) => s.headline), e0.stories.finance.map((s) => s.headline));
  assert.ok(e1.stories.finance.every((s) => s.rankChange === "=" && s.id.startsWith(toHourKey(h1))));
  assert.ok(e1.stories.tech.length > 0);

  // Everything fails (e.g. quota used up): nothing is published, the last edition stays live.
  const h2 = addHours(h0, 2);
  await assert.rejects(runHourlyIngest({ hour: h2, now: addHours(h2, -5 / 60), deps: deps(async () => { throw new Error("quota"); }) }));
  assert.equal(await editionExists(toHourKey(h2)), false);
});

test("when both models write nothing, synthesis retries in small batches before giving up", async () => {
  process.env.SYNTH_RETRY_DELAY_MS = "0";
  const prompts: string[] = [];
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (_u: string, init: RequestInit) => {
      const prompt = JSON.parse(String(init.body)).contents[0].parts[0].text as string;
      prompts.push(prompt);
      if (prompts.length <= 2) return new Response("bad answer", { status: 400 });
      const ids = [...prompt.matchAll(/id="(c\d+)"/g)].map((m) => m[1]);
      return reply(ids.map((id) => entry(id)));
    }) as typeof fetch;
    const out = await synthesizeCategory("finance", cl(8));
    assert.ok(out.every(Boolean));
    // 2 failed full attempts (primary, fallback) are followed by 2 batches of up to 6.
    const batches = prompts.filter((p) => /Write exactly/.test(p)).slice(-2);
    assert.match(batches[0], /Write exactly 6 entries/);
    assert.match(batches[1], /Write exactly 2 entries/);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.SYNTH_RETRY_DELAY_MS;
  }
});

test("stories the desk marks as of little interest to US readers rank lower", async () => {
  const synth = async (_c: unknown, list: { articles: { title: string }[] }[]) => list.map((c) => ({ headline: c.articles[0].title, summary: "S.", whyItMatters: "W." }));
  const topFinance = async (hour: Date, notUsTitle?: RegExp) => {
    const r = await runHourlyIngest({
      hour, now: addHours(hour, -5 / 60),
      deps: {
        fetch: async (n = new Date()) => ({ articles: articlesFor(BASE_EVENTS, n), feedErrors: [] }),
        synthesize: synth as never,
        dedupe: async (byCat: Record<string, { id: string; articles: { title: string }[] }[]>) => ({
          groups: [], categories: {},
          notUs: notUsTitle ? Object.values(byCat).flat().filter((c) => c.articles.some((a) => notUsTitle.test(a.title))).map((c) => c.id) : [],
        }),
      } as never,
    });
    assert.equal(r.status, "published");
    return (await readEditionUncached(toHourKey(hour)))!.stories.finance.map((s) => s.headline);
  };
  const h = addHours(truncateToHour(new Date()), -20);
  const plain = await topFinance(h);
  const marked = await topFinance(addHours(h, -1), new RegExp(plain[0].split(" ")[0]));
  assert.notEqual(marked[0], plain[0]);
  assert.ok(marked.indexOf(plain[0]) > 0);
});
