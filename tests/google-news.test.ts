import assert from "node:assert/strict";
import { test } from "node:test";
import type { Cluster } from "../lib/ingest/cluster";
import { googleMultiplier, googleRankFor, parseGoogleNewsRss } from "../lib/ingest/google-news";
import { tokens } from "../lib/ingest/text";

const xml = `<?xml version="1.0"?><rss><channel><title>Business - Google News</title>
<item><title>Fed holds interest rates steady as inflation cools - Reuters</title><link>https://news.google.com/rss/articles/x</link>
<description>&lt;ol&gt;&lt;li&gt;&lt;a href="https://news.google.com/rss/articles/a"&gt;Fed holds interest rates steady as inflation cools&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Reuters&lt;/font&gt;&lt;/li&gt;&lt;li&gt;&lt;a href="https://news.google.com/rss/articles/b"&gt;Powell signals patience on rate cuts after Fed decision&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;CNBC&lt;/font&gt;&lt;/li&gt;&lt;/ol&gt;</description></item>
<item><title>Oil prices slip on demand worries - Bloomberg</title><link>https://news.google.com/rss/articles/y</link></item>
</channel></rss>`;

const mk = (category: Cluster["category"], ...titles: string[]): Cluster => {
  const articles = titles.map((title, i) => ({ outlet: `O${i}`, tier: 1 as const, category, title, url: `u${i}`, teaser: "", publishedAt: new Date() }));
  const t = new Set<string>();
  articles.forEach((a) => tokens(a.title).forEach((x) => t.add(x)));
  return { id: "c", category, articles, tokens: t, score: 1, distinctOutlets: titles.length, newestAt: new Date() };
};

test("Google News RSS: headlines without the publisher, related headlines, positions", () => {
  const s = parseGoogleNewsRss(xml, "finance");
  assert.deepEqual(s.map((x) => x.rank), [1, 2]);
  assert.deepEqual(s[0].titles, ["Fed holds interest rates steady as inflation cools", "Powell signals patience on rate cuts after Fed decision"]);
  assert.deepEqual(s[1].titles, ["Oil prices slip on demand worries"]);
});

test("Google News match: same event in the same topic (or Google's top stories) gets a boost", () => {
  const google = parseGoogleNewsRss(xml, "finance");
  const ours = mk("finance", "Powell signals patience on rate cuts after Fed decision");
  assert.equal(googleRankFor(ours, google), 1); // matched through a related headline
  assert.equal(googleMultiplier(1), 1.8);
  // Same story filed in another tab doesn't match a Business-topic story...
  assert.equal(googleRankFor(mk("politics", "Powell signals patience on rate cuts after Fed decision"), google), null);
  // ...but Google's overall top stories match any tab.
  assert.equal(googleRankFor(mk("politics", "Powell signals patience on rate cuts after Fed decision"), parseGoogleNewsRss(xml, "top")), 1);
  assert.equal(googleRankFor(mk("finance", "Nvidia unveils new chip"), google), null);
  assert.equal(googleMultiplier(null), 1);
});
