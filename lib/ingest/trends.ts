import type { Cluster } from "./cluster";
import { downloadFeed, stripHtml } from "./fetch";
import { eventSimilarity, tokens } from "./text";

/**
 * Google Trends "Trending now" (US), the free public RSS feed. Used only as a signal: a story we
 * already have from our own outlets ranks higher, and can be HOT, when people are searching for
 * it. Google is never shown as a source and no text from this feed is published.
 */
export const TRENDS_URL = process.env.TRENDS_URL || "https://trends.google.com/trending/rss?geo=US";

export interface Trend {
  query: string;
  /** Position on the list by search volume, 1 = most searched. */
  rank: number;
  /** Approximate searches, e.g. "20,000+" -> 20000. */
  traffic: number;
  /** Headlines Google attaches to the trend, used for matching only. */
  titles: string[];
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? stripHtml(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "")) : "";
};

export function parseTraffic(raw: string): number {
  const m = raw.replace(/[,+\s]/g, "").match(/^([\d.]+)([KkMm]?)$/);
  if (!m) return 0;
  return Math.round(Number(m[1]) * (/k/i.test(m[2]) ? 1e3 : /m/i.test(m[2]) ? 1e6 : 1));
}

export function parseTrendsRss(xml: string): Trend[] {
  const out: Trend[] = [];
  for (const item of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const query = tag(item, "title");
    if (!query) continue;
    const titles = (item.match(/<ht:news_item_title>[\s\S]*?<\/ht:news_item_title>/g) ?? []).map((t) => tag(t, "ht:news_item_title")).filter(Boolean);
    out.push({ query, rank: 0, traffic: parseTraffic(tag(item, "ht:approx_traffic")), titles });
  }
  // Rank by search volume; ties keep Google's order.
  [...out].map((t, i) => ({ t, i })).sort((a, b) => b.t.traffic - a.t.traffic || a.i - b.i).forEach(({ t }, r) => (t.rank = r + 1));
  return out;
}

/** Never throws: if Google is unreachable or changes the feed, the hour is ranked as before. */
export async function fetchTrends(): Promise<Trend[]> {
  try {
    return parseTrendsRss(await downloadFeed(TRENDS_URL));
  } catch (err) {
    console.warn("[trends] skipped:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * The trend a story matches, if any: one of Google's headlines for the trend reports the same event
 * as one of ours, or the search term has 2+ words that all appear in our headlines
 * ("jensen huang"). One-word terms ("nvidia") are too broad to match on their own.
 */
export function trendFor(c: Cluster, trends: Trend[]): Trend | null {
  let best: Trend | null = null;
  const ours = c.articles.map((a) => tokens(a.title));
  for (const t of trends) {
    const q = tokens(t.query);
    const byQuery = q.size >= 2 && [...q].every((x) => c.tokens.has(x));
    const byTitle = !byQuery && t.titles.some((title) => {
      const theirs = tokens(title);
      return ours.some((o) => eventSimilarity(o, theirs) > 0);
    });
    if ((byQuery || byTitle) && (!best || t.traffic > best.traffic)) best = t;
  }
  return best;
}

/** Ranking boost for a trending story: bigger for bigger search interest. */
export function trendMultiplier(t: Trend | null): number {
  if (!t) return 1;
  if (t.traffic >= 100_000) return 2;
  if (t.traffic >= 10_000) return 1.6;
  return 1.3;
}
