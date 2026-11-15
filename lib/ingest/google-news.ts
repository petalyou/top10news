import type { Category } from "../types";
import type { Cluster } from "./cluster";
import { downloadFeed, stripHtml } from "./fetch";
import { eventSimilarity, tokens } from "./text";

/**
 * Google News top stories, read from Google's free public RSS feeds, used only as a ranking check:
 * a story Google is featuring that our own outlets also carry ranks higher in our list. Google's
 * headlines and links are never shown or stored; our sources and write-ups stay our own.
 */
const BASE = "https://news.google.com/rss";
const LOCALE = "hl=en-US&gl=US&ceid=US:en";
export const GOOGLE_NEWS_FEEDS: { topic: Category | "top"; url: string }[] = [
  { topic: "top", url: `${BASE}?${LOCALE}` },
  { topic: "finance", url: `${BASE}/headlines/section/topic/BUSINESS?${LOCALE}` },
  { topic: "tech", url: `${BASE}/headlines/section/topic/TECHNOLOGY?${LOCALE}` },
  { topic: "politics", url: `${BASE}/headlines/section/topic/NATION?${LOCALE}` },
  { topic: "world", url: `${BASE}/headlines/section/topic/WORLD?${LOCALE}` },
  { topic: "health", url: `${BASE}/headlines/section/topic/HEALTH?${LOCALE}` },
];

export interface GoogleStory {
  topic: Category | "top";
  /** Position in that Google feed, 1 = top. */
  rank: number;
  /** The headline and the related headlines Google groups with it (publisher suffix removed). */
  titles: string[];
}

const unwrap = (s: string) => s.replace(/^<!\[CDATA\[|\]\]>$/g, "");
/** "Fed holds rates steady - Reuters" -> "Fed holds rates steady" */
const dropSource = (t: string) => t.replace(/\s+[-–—|]\s+[^-–—|]{2,60}$/, "").trim();
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

export function parseGoogleNewsRss(xml: string, topic: GoogleStory["topic"]): GoogleStory[] {
  const out: GoogleStory[] = [];
  for (const item of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const title = dropSource(stripHtml(unwrap(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "")));
    if (!title) continue;
    const desc = decode(unwrap(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? ""));
    const related = [...desc.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)].map((m) => dropSource(stripHtml(m[1]))).filter(Boolean);
    out.push({ topic, rank: out.length + 1, titles: [...new Set([title, ...related])] });
  }
  return out;
}

/** Never throws: if Google is unreachable or changes its feeds, the hour is ranked as before. */
export async function fetchGoogleNews(feeds = GOOGLE_NEWS_FEEDS): Promise<GoogleStory[]> {
  const results = await Promise.allSettled(feeds.map(async (f) => parseGoogleNewsRss(await downloadFeed(f.url), f.topic)));
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) console.warn(`[google-news] ${failed} of ${feeds.length} feeds failed`);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

/** Best (lowest) Google rank of a story among Google's top stories and its own topic, or null. */
export function googleRankFor(c: Cluster, stories: GoogleStory[]): number | null {
  const ours = c.articles.map((a) => tokens(a.title));
  let best: number | null = null;
  for (const g of stories) {
    if (g.topic !== "top" && g.topic !== c.category) continue;
    if (best != null && g.rank >= best) continue;
    const hit = g.titles.some((t) => {
      const theirs = tokens(t);
      return ours.some((o) => eventSimilarity(o, theirs) > 0);
    });
    if (hit) best = g.rank;
  }
  return best;
}

/** Ranking boost for a story Google is featuring: stronger near the top of Google's list. */
export function googleMultiplier(rank: number | null): number {
  if (rank == null) return 1;
  if (rank <= 5) return 1.8;
  if (rank <= 15) return 1.45;
  return 1.2;
}
