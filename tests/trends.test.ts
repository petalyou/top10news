import assert from "node:assert/strict";
import { test } from "node:test";
import type { Cluster } from "../lib/ingest/cluster";
import { pickHot } from "../lib/ingest/hot";
import { tokens } from "../lib/ingest/text";
import { parseTraffic, parseTrendsRss, trendFor, trendMultiplier } from "../lib/ingest/trends";

const xml = `<?xml version="1.0"?><rss xmlns:ht="https://trends.google.com/trending/rss"><channel>
<item><title>jensen huang</title><ht:approx_traffic>200,000+</ht:approx_traffic>
  <ht:news_item><ht:news_item_title><![CDATA[Tech leaders back Jensen Huang after Nvidia exit]]></ht:news_item_title><ht:news_item_url>https://x</ht:news_item_url></ht:news_item>
</item>
<item><title>powerball</title><ht:approx_traffic>50K+</ht:approx_traffic></item>
<item><title>fed</title><ht:approx_traffic>2000+</ht:approx_traffic>
  <ht:news_item><ht:news_item_title>Federal Reserve holds interest rates steady</ht:news_item_title></ht:news_item>
</item></channel></rss>`;

const now = new Date("2026-11-15T01:00:00Z");
const mk = (titles: [string, string][], minutesAgo = 30): Cluster => {
  const articles = titles.map(([outlet, title], i) => ({ outlet, tier: 1 as const, category: "tech" as const, title, url: `https://${outlet}.x/${i}`, teaser: "", publishedAt: new Date(now.getTime() - minutesAgo * 60_000) }));
  const t = new Set<string>();
  articles.forEach((a) => tokens(a.title).forEach((x) => t.add(x)));
  return { id: "c", category: "tech", articles, tokens: t, score: 1, distinctOutlets: new Set(titles.map((x) => x[0])).size, newestAt: now };
};

test("Google Trends RSS: parses searches, traffic and headlines", () => {
  const trends = parseTrendsRss(xml);
  assert.deepEqual(trends.map((t) => [t.query, t.traffic]), [["jensen huang", 200000], ["powerball", 50000], ["fed", 2000]]);
  assert.deepEqual(trends[0].titles, ["Tech leaders back Jensen Huang after Nvidia exit"]);
  assert.equal(parseTraffic("1M+"), 1000000);
  assert.equal(parseTraffic(""), 0);
});

test("Google Trends match: multi-word search or same-event headline; one-word searches don't match alone", () => {
  const trends = parseTrendsRss(xml);
  const huang = mk([["NYT", "Tech executives rally behind Jensen Huang"], ["TechCrunch", "Letter backs Huang"]]);
  assert.equal(trendFor(huang, trends)?.query, "jensen huang");
  assert.equal(trendMultiplier(trendFor(huang, trends)), 2);
  const fed = mk([["Reuters", "Federal Reserve holds interest rates steady again"]]);
  assert.equal(trendFor(fed, trends)?.query, "fed"); // via Google's headline, not the one-word term
  const fedBroad = mk([["Reuters", "Fed officials split on December cut"]]);
  assert.equal(trendFor(fedBroad, trends), null);
  assert.equal(trendMultiplier(null), 1);
});

test("HOT: a trending story with 2+ recent outlets is HOT; NEW still wins", () => {
  const two = mk([["NYT", "Tech executives rally behind Jensen Huang"], ["TechCrunch", "Letter backs Huang"]]);
  const one = mk([["NYT", "Tech executives rally behind Jensen Huang"]]);
  assert.deepEqual(pickHot([one, two], ["=", "-1"], now, [true, true]), [false, true]);
  assert.deepEqual(pickHot([two], ["NEW"], now, [true]), [false]);
});
