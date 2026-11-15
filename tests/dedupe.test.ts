/** Duplicate safeguards: same article in two feeds, and identical written headlines. */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const dir = await mkdtemp(path.join(tmpdir(), "top10-dup-"));
process.env.LOCAL_DATA_DIR = dir;
const { runHourlyIngest } = await import("../lib/ingest/pipeline");
const { dedupeWritten, sameHeadline } = await import("../lib/ingest/final-dedupe");
const { readEditionUncached } = await import("../lib/storage");
const { addHours, toHourKey, truncateToHour } = await import("../lib/hour");
const { articlesFor } = await import("./fixtures");
type Ev = Parameters<typeof articlesFor>[0][number];
after(() => rm(dir, { recursive: true, force: true }));

const O = (outlet: string, tier: 1 | 2 | 3) => ({ outlet, tier });
const FILLER = [
  "Kenya opens new geothermal plant in Rift Valley", "Peru elects mayor after disputed count", "Norway expands Arctic fishing quotas",
  "Vietnam launches coastal high-speed railway", "Ghana cocoa harvest rebounds strongly", "Chile drought forces water rationing",
  "Poland unveils defence spending bill", "Egypt reopens ancient museum wing", "Japan tests typhoon warning satellites",
  "Brazil protects Amazon reserve land", "India monsoon floods displace villages", "Canada wildfire season ends early",
];
const filler = (n: number): Ev[] =>
  FILLER.slice(0, n).map((title, i) => ({ category: "world" as const, titles: [title], outlets: [O(`Outlet${i}`, 2)], minutesAgo: 30 + i * 3 }));
const synth = async (_c: unknown, cl: { articles: { title: string }[] }[]) => cl.map((c) => ({ headline: c.articles[0].title, summary: "S.", whyItMatters: "W." }));

test("headline comparison", () => {
  assert.ok(sameHeadline("Telecoms Upgrade Work Blamed for U.S. Flight Disruptions", "Telecoms upgrade work blamed for US flight disruptions"));
  assert.ok(!sameHeadline("Nvidia beats earnings forecasts", "Nvidia faces new antitrust probe in Europe"));
});

test("the same article in two feeds becomes one story after re-filing", async () => {
  const hour = addHours(truncateToHour(new Date()), -8);
  const faaUS: Ev = { category: "politics", titles: ["FAA blames telecoms upgrade for flight disruptions"], outlets: [O("BBC News", 1)], minutesAgo: 10 };
  const faaWorld: Ev = { ...faaUS, category: "world" };
  await runHourlyIngest({
    hour, now: addHours(hour, -5 / 60),
    deps: {
      fetch: async (n = new Date()) => ({ articles: articlesFor([faaUS, faaWorld, ...filler(10)], n), feedErrors: [] }),
      synthesize: synth as never,
      dedupe: async (byCat) => {
        const categories: Record<string, "world"> = {};
        for (const cl of Object.values(byCat)) for (const c of cl ?? []) categories[c.id] = "world";
        return { groups: [], categories }; // the model didn't group them; the URL match must
      },
    },
  });
  const e = (await readEditionUncached(toHourKey(hour)))!;
  const faa = e.stories.world.filter((s) => /FAA/.test(s.headline));
  assert.equal(faa.length, 1);
  assert.equal(e.stories.world.length, 10);
});

test("two stories written with the same headline are merged and a spare fills the slot", async () => {
  const hour = addHours(truncateToHour(new Date()), -20);
  const twins: Ev[] = [
    { category: "world", titles: ["Airport outage strands travellers across Europe"], outlets: [O("BBC News", 1), O("DW", 2)], minutesAgo: 8 },
    { category: "world", titles: ["Rail strike halts trains in France"], outlets: [O("France 24", 2), O("NPR", 1)], minutesAgo: 9 },
  ];
  const sameName = async (_c: unknown, cl: { articles: { title: string }[] }[]) =>
    cl.map((c) => ({ headline: /Airport|Rail/.test(c.articles[0].title) ? "Travel chaos hits Europe" : c.articles[0].title, summary: "S.", whyItMatters: "W." }));
  await runHourlyIngest({
    hour, now: addHours(hour, -5 / 60),
    deps: { fetch: async (n = new Date()) => ({ articles: articlesFor([...twins, ...filler(10)], n), feedErrors: [] }), synthesize: sameName as never, dedupe: async () => ({ groups: [], categories: {} }) },
  });
  const e = (await readEditionUncached(toHourKey(hour)))!;
  const heads = e.stories.world.map((s) => s.headline);
  assert.equal(heads.filter((h) => h === "Travel chaos hits Europe").length, 1);
  assert.equal(heads.length, 10);
  assert.equal(new Set(heads).size, 10);
  assert.deepEqual(e.stories.world.map((s) => s.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("merge keeps the earlier identity so a carried-over story isn't relabelled NEW", () => {
  const mk = (id: string, url: string) => ({ id, category: "world", articles: [{ url, outlet: "BBC News" }], tokens: new Set([id]), score: 0, distinctOutlets: 1, newestAt: new Date() }) as never;
  const a = mk("a", "u1");
  const b = mk("b", "u2");
  const prev = { storyKey: "old", firstSeen: "2026-11-14-10", rank: 5 } as never;
  const prevFor = new Map<unknown, { storyKey: string } | null>([[a, null], [b, prev]]);
  const t = { headline: "Same", summary: "S", whyItMatters: "W" };
  const r = dedupeWritten([a, b], [t, { ...t }], prevFor as never);
  assert.equal(r.clusters.length, 1);
  assert.equal(r.clusters[0].articles.length, 2);
  assert.equal(prevFor.get(r.clusters[0])?.storyKey, "old");
});

test("follow-up developments stay separate from the original story; true duplicates still merge", async () => {
  const { clusterArticles, sameEventGroups } = await import("../lib/ingest/cluster");
  const { sameHeadline } = await import("../lib/ingest/final-dedupe");
  const t0 = new Date("2026-11-15T00:00:00Z");
  const mk = (outlet: string, title: string, url: string) =>
    ({ outlet, tier: 1 as const, category: "tech" as const, title, url, teaser: "", publishedAt: t0 });
  const original = mk("New York Times", "Nvidia CEO Jensen Huang Resigns Following Concealed Relationship", "https://nyt.x/a");
  const followUp = mk("New York Times", "Tech executives rally behind Jensen Huang following Nvidia resignation", "https://nyt.x/b");
  const tcFollowUp = mk("TechCrunch", "Tech leaders sign letter backing Jensen Huang after Nvidia resignation", "https://tc.x/c");
  const paraphrase = mk("Bloomberg", "Nvidia CEO Jensen Huang resigns", "https://bb.x/d");
  const clusters = clusterArticles([original, followUp, tcFollowUp, paraphrase]);
  const home = (url: string) => clusters.find((c) => c.articles.some((a) => a.url === url))!.id;
  assert.notEqual(home(original.url), home(followUp.url));
  assert.equal(home(original.url), home(paraphrase.url));
  assert.deepEqual(sameEventGroups(clusters), []);
  assert.equal(sameHeadline("Nvidia CEO Jensen Huang resigns after concealed relationship", "Tech executives rally behind Jensen Huang after Nvidia resignation"), false);
  assert.equal(sameHeadline("Nvidia CEO Jensen Huang resigns after concealed relationship", "Nvidia CEO Jensen Huang resigns after a concealed relationship"), true);
});

test("differently worded duplicates merge when Gemini links them; follow-ups it doesn't link stay apart", async () => {
  const hour = addHours(truncateToHour(new Date()), -30);
  const evs: Ev[] = [
    { category: "world", titles: ["SpaceX successfully catches Starship for the first time"], outlets: [O("The Hill", 1), O("Al Jazeera", 1)], minutesAgo: 8 },
    { category: "world", titles: ["SpaceX executes first catch of Starship using launch tower arms"], outlets: [O("The Verge", 2), O("Engadget", 2)], minutesAgo: 9 },
    { category: "world", titles: ["Nvidia CEO Jensen Huang resigns following concealed relationship"], outlets: [O("New York Times", 1)], minutesAgo: 10 },
    { category: "world", titles: ["Tech executives rally behind Jensen Huang following Nvidia resignation"], outlets: [O("TechCrunch", 2)], minutesAgo: 11 },
  ];
  // Gemini writes each story and says which one repeats another (the second SpaceX story -> the first).
  const linking = async (_c: unknown, cl: { articles: { title: string }[] }[]) => {
    const first = cl.findIndex((c) => /catches Starship/.test(c.articles[0].title));
    return cl.map((c) => ({
      headline: c.articles[0].title,
      summary: "S.",
      whyItMatters: "W.",
      ...(/tower arms/.test(c.articles[0].title) && first >= 0 ? { sameAs: first } : {}),
    }));
  };
  await runHourlyIngest({
    hour, now: addHours(hour, -5 / 60),
    deps: { fetch: async (n = new Date()) => ({ articles: articlesFor([...evs, ...filler(10)], n), feedErrors: [] }), synthesize: linking as never, dedupe: async () => ({ groups: [], categories: {} }) },
  });
  const e = (await readEditionUncached(toHourKey(hour)))!;
  const spacex = e.stories.world.filter((s) => /Starship/.test(s.headline));
  assert.equal(spacex.length, 1);
  assert.deepEqual(spacex[0].sources.map((s) => s.outlet).sort(), ["Al Jazeera", "Engadget", "The Hill", "The Verge"]);
  assert.equal(e.stories.world.filter((s) => /Huang/.test(s.headline)).length, 2);
  assert.equal(e.stories.world.length, 10);
});

test("Gemini's same_event_as answer is read into sameAs", async () => {
  const { synthesizeCategory } = await import("../lib/ingest/synthesize");
  process.env.GEMINI_API_KEY ||= "test";
  const story = (id: string, same: string) => ({
    id, headline: `H ${id}`, summary: "S.", why_it_matters: "W.", headline_es: "", summary_es: "", why_it_matters_es: "", headline_zh: "", summary_zh: "", why_it_matters_zh: "", same_event_as: same,
  });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ stories: [story("c1", ""), story("c2", "c1"), story("c3", "c3")] }) }] }, finishReason: "STOP" }] }))) as unknown as typeof fetch;
  try {
    const cl = [0, 1, 2].map((i) => ({ id: `k${i}`, category: "tech", articles: [{ outlet: "X", title: `t${i}`, url: `u${i}`, teaser: "" }] })) as never[];
    const out = await synthesizeCategory("tech", cl);
    assert.deepEqual(out.map((o) => o?.sameAs), [undefined, 0, undefined]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the same article in three feed sections shows in only one tab", async () => {
  const hour = addHours(truncateToHour(new Date()), -40);
  const starship: Ev = { category: "world", titles: ["SpaceX catches Starship rocket stage using mechanical arms"], outlets: [O("BBC News", 1)], minutesAgo: 6 };
  const evs: Ev[] = [starship, { ...starship, category: "politics" }, { ...starship, category: "tech" }];
  await runHourlyIngest({
    hour, now: addHours(hour, -5 / 60),
    // The content re-filing didn't run, so each copy stays in its feed's section.
    deps: { fetch: async (n = new Date()) => ({ articles: articlesFor([...evs, ...filler(12)], n), feedErrors: [] }), synthesize: synth as never, dedupe: async () => ({ groups: [], categories: {} }) },
  });
  const e = (await readEditionUncached(toHourKey(hour)))!;
  const tabs = (Object.keys(e.stories) as (keyof typeof e.stories)[]).filter((c) => e.stories[c].some((s) => /Starship/.test(s.headline)));
  assert.equal(tabs.length, 1);
});
