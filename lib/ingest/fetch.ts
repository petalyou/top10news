import Parser from "rss-parser";
import { FEEDS, isOptedOut, optedOutDomains, type FeedConfig } from "../feeds";
import type { Category } from "../types";

export interface Article {
  outlet: string;
  category: Category;
  tier: FeedConfig["tier"];
  title: string;
  url: string;
  /** Plain-text teaser from the feed (trimmed). Used only as LLM context, never displayed. */
  teaser: string;
  publishedAt: Date;
}

export interface FetchReport {
  articles: Article[];
  feedErrors: { outlet: string; url: string; error: string }[];
}

// Feeds are downloaded with the platform fetch (works on Cloudflare Workers and Node)
// and only parsed by rss-parser.
const parser = new Parser();
const FEED_HEADERS = {
  "User-Agent": process.env.INGEST_USER_AGENT || "Top10HourlyBot/1.0 (+headline aggregation; links to publishers)",
  Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
};

async function downloadFeed(url: string): Promise<string> {
  const res = await fetch(url, { headers: FEED_HEADERS, redirect: "follow", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const TRACKING_PARAMS = /^(utm_|mc_|fbclid|gclid|cmpid|ref$|src$|smid|mod$|taid|ncid)/i;

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k);
    u.hostname = u.hostname.toLowerCase();
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8216;|&lsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFeed(feed: FeedConfig, since: Date, now: Date, optOut: string[]): Promise<Article[]> {
  const parsed = await parser.parseString(await downloadFeed(feed.url));
  const out: Article[] = [];
  for (const item of parsed.items ?? []) {
    const title = stripHtml(item.title ?? "");
    const link = item.link ?? item.guid ?? "";
    const dateStr = item.isoDate ?? item.pubDate;
    if (!title || !/^https?:\/\//.test(link) || !dateStr) continue;
    const publishedAt = new Date(dateStr);
    if (Number.isNaN(publishedAt.getTime())) continue;
    // Window: last N hours, tolerating small clock skew in feeds.
    if (publishedAt < since || publishedAt.getTime() > now.getTime() + 10 * 60_000) continue;
    if (isOptedOut(link, optOut)) continue;
    const teaser = stripHtml(item.contentSnippet ?? item.summary ?? item.content ?? "").slice(0, 400);
    out.push({
      outlet: feed.outlet,
      category: feed.category,
      tier: feed.tier,
      title,
      url: canonicalUrl(link),
      teaser,
      publishedAt,
    });
  }
  return out;
}

/** Pull every whitelisted feed in parallel and keep items from the last `windowHours`. */
export async function fetchArticles(now = new Date(), windowHours = 4, feeds = FEEDS): Promise<FetchReport> {
  const since = new Date(now.getTime() - windowHours * 3_600_000);
  const optOut = optedOutDomains();
  const results = await Promise.allSettled(feeds.map((f) => fetchFeed(f, since, now, optOut)));

  const seen = new Set<string>();
  const articles: Article[] = [];
  const feedErrors: FetchReport["feedErrors"] = [];

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      feedErrors.push({ outlet: feeds[i].outlet, url: feeds[i].url, error: String(r.reason?.message ?? r.reason) });
      return;
    }
    for (const a of r.value) {
      const key = `${a.category}|${a.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      articles.push(a);
    }
  });

  return { articles, feedErrors };
}
