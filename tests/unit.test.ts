import assert from "node:assert/strict";
import { test } from "node:test";
import { getActiveSponsors, loadSponsors } from "../lib/sponsors";
import sponsorsFile from "../data/sponsors.json";
import { parseHourKey, toHourKey, localDateParts } from "../lib/hour";
import { clusterArticles, mergeClusters, pickSources, selectTopClusters } from "../lib/ingest/cluster";
import { diffAgainstPrevious, formatRankChange } from "../lib/ingest/diff";
import { canonicalUrl } from "../lib/ingest/fetch";
import { isOptedOut } from "../lib/feeds";
import { localizeStory, type Story } from "../lib/types";
import { articlesFor, BASE_EVENTS } from "./fixtures";

const NOW = new Date("2026-11-12T20:55:00Z");

test("hour keys round-trip and reject bad input", () => {
  const d = new Date("2026-11-12T14:00:00Z");
  assert.equal(toHourKey(d), "2026-11-12-14");
  assert.equal(parseHourKey("2026-11-12-14")?.toISOString(), d.toISOString());
  for (const bad of ["2026-02-31-10", "2026-11-12-24", "2026-11-12", "x", null]) assert.equal(parseHourKey(bad), null);
});

test("local date parts follow the display zone (DST-aware)", () => {
  assert.deepEqual(localDateParts(new Date("2026-11-13T01:30:00Z"), "America/Denver"), { date: "2026-11-12", hour: 18 });
  assert.deepEqual(localDateParts(new Date("2026-07-13T00:30:00Z"), "America/Denver"), { date: "2026-07-12", hour: 18 });
});

test("canonicalUrl strips tracking params and fragments", () => {
  assert.equal(canonicalUrl("https://Example.com/a?utm_source=x&id=3#top"), "https://example.com/a?id=3");
});

test("publisher opt-out matches domain and subdomains", () => {
  assert.equal(isOptedOut("https://www.nytimes.com/x", ["nytimes.com"]), true);
  assert.equal(isOptedOut("https://rss.nytimes.com/x", ["nytimes.com"]), true);
  assert.equal(isOptedOut("https://notnytimes.com/x", ["nytimes.com"]), false);
});

test("clustering groups headline variants of the same event", () => {
  const clusters = clusterArticles(articlesFor(BASE_EVENTS, NOW));
  const tech = clusters.filter((c) => c.category === "tech");
  assert.equal(tech.length, 4, tech.map((c) => c.articles.map((a) => a.title)).join(" | "));
  const nvidia = tech.find((c) => c.articles.some((a) => a.title.includes("Huang")))!;
  assert.equal(nvidia.articles.length, 6);
  // Finance has 3 events; "stock plunges" vs "shares tumble" share too few words
  // to merge lexically, which is what the LLM dedupe pass is for.
  assert.ok(clusters.filter((c) => c.category === "finance").length <= 4);
});

test("mergeClusters combines same-event clusters within a category only", () => {
  const clusters = clusterArticles(articlesFor(BASE_EVENTS, NOW));
  const fin = clusters.filter((c) => c.category === "finance" && c.articles.some((a) => a.title.includes("Nvidia")));
  const tech = clusters.find((c) => c.category === "tech")!;
  const merged = mergeClusters(clusters, [fin.map((c) => c.id), [tech.id, fin[0].id]]);
  const nv = merged.filter((c) => c.category === "finance" && c.articles.some((a) => a.title.includes("Nvidia")));
  assert.equal(nv.length, 1);
  assert.equal(nv[0].articles.length, 4);
  assert.equal(merged.filter((c) => c.category === "finance").length, 3);
  assert.equal(merged.length, clusters.length - (fin.length - 1));
});

test("velocity ranking puts multi-outlet, top-tier, recent stories first", () => {
  const top = selectTopClusters(clusterArticles(articlesFor(BASE_EVENTS, NOW)), NOW);
  assert.match(top.tech[0].articles[0].title, /Huang|Nvidia/);
  assert.match(top.tech[top.tech.length - 1].articles[0].title, /AntiFox/);
  assert.ok(top.tech.length <= 10);
  const srcs = pickSources(top.tech[0]);
  assert.equal(new Set(srcs.map((s) => s.outlet)).size, srcs.length);
  assert.ok(srcs.length <= 5);
});

test("rank change formatting", () => {
  assert.equal(formatRankChange(null, 3), "NEW");
  assert.equal(formatRankChange(null, 3, false), "");
  assert.equal(formatRankChange(4, 2), "+2");
  assert.equal(formatRankChange(1, 2), "-1");
  assert.equal(formatRankChange(5, 5), "=");
});

test("diff matches last hour's stories and carries story keys", () => {
  const top = selectTopClusters(clusterArticles(articlesFor(BASE_EVENTS, NOW)), NOW).tech;
  const prev: Story[] = [
    { id: "1", category: "tech", rank: 1, rankChange: "NEW", storyKey: "k-alpha", headline: "DeepMind unveils AlphaGenome 2 model", summary: "", whyItMatters: "", sources: [{ outlet: "BBC News", url: "https://other.example/x", title: "DeepMind launches AlphaGenome 2 for DNA variant prediction" }] },
    { id: "2", category: "tech", rank: 2, rankChange: "NEW", storyKey: "k-old", headline: "Something unrelated about phones", summary: "", whyItMatters: "", sources: [] },
  ];
  const res = diffAgainstPrevious(top, prev);
  const alphaIdx = top.findIndex((c) => c.articles.some((a) => a.title.includes("AlphaGenome")));
  assert.equal(res[alphaIdx].storyKey, "k-alpha");
  assert.equal(res[alphaIdx].rankChange, formatRankChange(1, alphaIdx + 1));
  assert.equal(res[0].rankChange, "NEW");
  assert.notEqual(res[0].storyKey, "k-old");
});

test("data/sponsors.json is valid", () => {
  const raw = (sponsorsFile as { sponsors: unknown[] }).sponsors;
  assert.equal(loadSponsors(sponsorsFile).length, raw.length, "every entry in data/sponsors.json must pass validation");
});

test("sponsor selection: category beats 'all', respects dates and is_active", () => {
  const base = { sponsor_name: "S", headline: "H", summary: "S.", cta_label: "Go", target_url: "https://x.example", is_active: true };
  const records = loadSponsors({
    sponsors: [
      { ...base, id: "ros", category: "all", slot_type: "title_banner", sponsor_name: "RunOfSite", start_date: "2026-11-01", end_date: "2026-11-30" },
      { ...base, id: "tech", category: "tech", slot_type: "title_banner", sponsor_name: "TechCo", start_date: "2026-11-10", end_date: "2026-11-15" },
      { ...base, id: "old", category: "finance", slot_type: "native_briefing", start_date: "2026-10-01", end_date: "2026-10-31" },
      { ...base, id: "off", category: "all", slot_type: "native_briefing", start_date: "2026-11-01", end_date: "2026-11-30", is_active: false },
      { id: "broken", category: "sports" },
    ],
  });
  assert.equal(records.length, 4);
  assert.equal(getActiveSponsors("tech", "2026-11-12", records).titleBanner?.sponsorName, "TechCo");
  assert.equal(getActiveSponsors("tech", "2026-11-20", records).titleBanner?.sponsorName, "RunOfSite");
  assert.equal(getActiveSponsors("finance", "2026-11-12", records).titleBanner?.sponsorName, "RunOfSite");
  assert.equal(getActiveSponsors("finance", "2026-11-12", records).nativeBriefing, null);
  assert.equal(getActiveSponsors("politics", "2026-12-05", records).titleBanner, null);
});

test("localizeStory swaps in translations and falls back to English", () => {
  const story: Story = {
    id: "x", category: "tech", rank: 1, rankChange: "NEW", storyKey: "k", sources: [],
    headline: "EN head", summary: "EN sum.", whyItMatters: "EN why.",
    i18n: { es: { headline: "ES head", summary: "ES sum.", whyItMatters: "ES why." } },
  };
  assert.equal(localizeStory(story, "es").headline, "ES head");
  assert.equal(localizeStory(story, "zh").headline, "EN head");
  assert.equal(localizeStory(story, "en").headline, "EN head");
});

test("sponsor translations override per field", () => {
  const records = loadSponsors(sponsorsFile);
  const zh = getActiveSponsors("tech", "2026-11-12", records, "zh");
  const en = getActiveSponsors("tech", "2026-11-12", records, "en");
  assert.equal(zh.titleBanner?.headline, en.titleBanner?.headline); // not translated -> English
  assert.notEqual(zh.titleBanner?.summary, en.titleBanner?.summary);
  assert.equal(zh.nativeBriefing?.ctaLabel, "了解更多 →");
});

test("publishing day runs 5 AM to midnight Eastern", async () => {
  const { isEditionHour, nextEditionTime } = await import("../lib/hour");
  const tz = "America/New_York";
  // Nov (EST, UTC-5)
  assert.equal(isEditionHour(new Date("2026-11-13T10:00:00Z"), tz), true); // 5 AM
  assert.equal(isEditionHour(new Date("2026-11-13T04:00:00Z"), tz), true); // 11 PM
  assert.equal(isEditionHour(new Date("2026-11-13T05:00:00Z"), tz), true); // midnight
  assert.equal(isEditionHour(new Date("2026-11-13T06:00:00Z"), tz), false); // 1 AM
  assert.equal(isEditionHour(new Date("2026-11-13T09:00:00Z"), tz), false); // 4 AM
  // After the midnight edition, the next one is 5 AM.
  assert.equal(nextEditionTime(new Date("2026-11-13T05:10:00Z"), tz).toISOString(), "2026-11-13T10:00:00.000Z");
  assert.equal(nextEditionTime(new Date("2026-11-13T15:30:00Z"), tz).toISOString(), "2026-11-13T16:00:00.000Z");
  // July (EDT, UTC-4): 5 AM is 09:00Z.
  assert.equal(nextEditionTime(new Date("2026-07-13T05:00:00Z"), tz).toISOString(), "2026-07-13T09:00:00.000Z");
});
