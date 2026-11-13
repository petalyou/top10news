import type { Category } from "./types";

/**
 * Curated whitelist of official, publicly offered RSS/Atom feeds.
 * We only read headline/teaser metadata these publishers syndicate, link out to
 * the original article, and never fetch article pages, paywalled text or images.
 *
 * tier: 1 = national/wire-grade newsroom or primary official source
 *       2 = established specialist outlet
 *       3 = supplementary
 *
 * Note: Reuters and AP no longer publish public RSS feeds, so they are not listed.
 * Add licensed feeds here if you obtain them.
 */
export interface FeedConfig {
  outlet: string;
  url: string;
  category: Category;
  tier: 1 | 2 | 3;
}

export const FEEDS: FeedConfig[] = [
  // ---------------------------- Tech & AI ----------------------------
  { outlet: "TechCrunch", url: "https://techcrunch.com/feed/", category: "tech", tier: 2 },
  { outlet: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "tech", tier: 2 },
  { outlet: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "tech", tier: 2 },
  { outlet: "Wired", url: "https://www.wired.com/feed/rss", category: "tech", tier: 2 },
  { outlet: "Engadget", url: "https://www.engadget.com/rss.xml", category: "tech", tier: 3 },
  { outlet: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", category: "tech", tier: 2 },
  { outlet: "The Register", url: "https://www.theregister.com/headlines.atom", category: "tech", tier: 3 },
  { outlet: "VentureBeat", url: "https://venturebeat.com/category/ai/feed/", category: "tech", tier: 3 },
  { outlet: "New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", category: "tech", tier: 1 },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "tech", tier: 1 },
  { outlet: "The Guardian", url: "https://www.theguardian.com/technology/rss", category: "tech", tier: 1 },
  { outlet: "OpenAI", url: "https://openai.com/news/rss.xml", category: "tech", tier: 1 },
  { outlet: "Google", url: "https://blog.google/technology/ai/rss/", category: "tech", tier: 1 },
  { outlet: "NVIDIA Newsroom", url: "https://nvidianews.nvidia.com/releases.xml", category: "tech", tier: 1 },

  // ------------------------- Finance & Markets -------------------------
  { outlet: "Bloomberg", url: "https://feeds.bloomberg.com/markets/news.rss", category: "finance", tier: 1 },
  { outlet: "Wall Street Journal", url: "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", category: "finance", tier: 1 },
  { outlet: "Financial Times", url: "https://www.ft.com/markets?format=rss", category: "finance", tier: 1 },
  { outlet: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664", category: "finance", tier: 1 },
  { outlet: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", category: "finance", tier: 2 },
  { outlet: "New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", category: "finance", tier: 1 },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "finance", tier: 1 },
  { outlet: "The Guardian", url: "https://www.theguardian.com/business/rss", category: "finance", tier: 1 },
  { outlet: "Fortune", url: "https://fortune.com/feed/", category: "finance", tier: 2 },
  { outlet: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex", category: "finance", tier: 3 },
  { outlet: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "finance", tier: 3 },
  { outlet: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml", category: "finance", tier: 1 },
  { outlet: "SEC", url: "https://www.sec.gov/news/pressreleases.rss", category: "finance", tier: 1 },

  // ------------------------------ Politics ------------------------------
  { outlet: "Politico", url: "https://rss.politico.com/politics-news.xml", category: "politics", tier: 2 },
  { outlet: "The Hill", url: "https://thehill.com/homenews/feed/", category: "politics", tier: 2 },
  { outlet: "NPR", url: "https://feeds.npr.org/1014/rss.xml", category: "politics", tier: 1 },
  { outlet: "New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", category: "politics", tier: 1 },
  { outlet: "Washington Post", url: "https://feeds.washingtonpost.com/rss/politics", category: "politics", tier: 1 },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml", category: "politics", tier: 1 },
  { outlet: "The Guardian", url: "https://www.theguardian.com/us-news/us-politics/rss", category: "politics", tier: 1 },
  { outlet: "Fox News", url: "https://moxie.foxnews.com/google-publisher/politics.xml", category: "politics", tier: 2 },
  { outlet: "CBS News", url: "https://www.cbsnews.com/latest/rss/politics", category: "politics", tier: 2 },
  { outlet: "ABC News", url: "https://abcnews.go.com/abcnews/politicsheadlines", category: "politics", tier: 2 },
  { outlet: "Axios", url: "https://api.axios.com/feed/", category: "politics", tier: 2 },
  { outlet: "Roll Call", url: "https://rollcall.com/feed/", category: "politics", tier: 3 },

  // -------------------------------- World --------------------------------
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "world", tier: 1 },
  { outlet: "New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", category: "world", tier: 1 },
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/rss", category: "world", tier: 1 },
  { outlet: "NPR", url: "https://feeds.npr.org/1004/rss.xml", category: "world", tier: 1 },
  { outlet: "Washington Post", url: "https://feeds.washingtonpost.com/rss/world", category: "world", tier: 1 },
  { outlet: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", category: "world", tier: 2 },
  { outlet: "DW", url: "https://rss.dw.com/rdf/rss-en-world", category: "world", tier: 2 },
  { outlet: "France 24", url: "https://www.france24.com/en/rss", category: "world", tier: 2 },
  { outlet: "CBS News", url: "https://www.cbsnews.com/latest/rss/world", category: "world", tier: 2 },
  { outlet: "ABC News", url: "https://abcnews.go.com/abcnews/internationalheadlines", category: "world", tier: 2 },
  { outlet: "Fox News", url: "https://moxie.foxnews.com/google-publisher/world.xml", category: "world", tier: 2 },
  { outlet: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362", category: "world", tier: 2 },
  { outlet: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", category: "world", tier: 1 },
];

export const TIER_WEIGHT: Record<FeedConfig["tier"], number> = { 1: 3, 2: 2, 3: 1 };

/** Publisher opt-outs: comma-separated hostnames in OPTOUT_DOMAINS are never ingested. */
export function optedOutDomains(): string[] {
  return (process.env.OPTOUT_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
}

export function isOptedOut(url: string, domains = optedOutDomains()): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return true;
  }
}
