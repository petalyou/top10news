import { addHours, isEditionHour, toHourKey, truncateToHour } from "../hour";
import { editionExists, publishEdition, readPreviousEdition, storageMode } from "../storage";
import { CATEGORIES, type Category, type Edition, type Story } from "../types";
import { clusterArticles, mergeClusters, pickSources, sameEventGroups, selectTopClusters, type Cluster } from "./cluster";
import { crossCategoryDedupe, dedupeWritten } from "./final-dedupe";
import { overlap } from "./text";
import { randomUUID } from "node:crypto";
import { formatRankChange, matchPrevious } from "./diff";
import { firstSeenFor, freshnessMultiplier, hoursInTop } from "./freshness";
import { fetchArticles } from "./fetch";
import { findDuplicateGroups, synthesizeCategory, type Synthesis } from "./synthesize";
import { pickHot } from "./hot";
import { translateStories } from "./translate";
import { fetchTrends, trendFor, trendMultiplier, type Trend } from "./trends";
import { fetchGoogleNews, googleMultiplier, googleRankFor, type GoogleStory } from "./google-news";

export interface IngestResult {
  hour: string;
  status: "published" | "skipped_already_published" | "skipped_no_articles" | "skipped_off_hours";
  /** Categories that reused the previous edition's list because Gemini wrote none of their stories. */
  fallbackCategories?: Category[];
  storage: "r2" | "local";
  articleCount: number;
  clusterCount: number;
  storyCounts: Record<Category, number>;
  feedErrors: { outlet: string; url: string; error: string }[];
  /** Google Trends check: how many trending searches were read, and which ones matched a published story. */
  trends?: { fetched: number; matched: string[] };
  /** Google News check: how many Google top stories were read, and how many published stories matched one. */
  googleNews?: { fetched: number; matched: number };
  durationMs: number;
}

/**
 * The edition an ingest run at `now` produces. Runs at :55 build the *next*
 * hour (14:55 -> 15:00). Anything before :30 is treated as a late run for the
 * current hour, so a manual or retried trigger still fills the right slot.
 */
export function targetHourFor(now: Date): Date {
  const hour = truncateToHour(now);
  return now.getUTCMinutes() >= 30 ? addHours(hour, 1) : hour;
}

/** Stories per category. */
const TOP_N = 10;
/**
 * Extra candidates written per category so a dropped, merged or unwritten story still leaves 10.
 * Spares cost no extra Gemini requests (they ride in the same write-up call).
 */
const SPARES = 4;
/** Normal fetch window, and the wider window used only to backfill a category that came up short. */
const WINDOW_HOURS = 4;
const BACKFILL_WINDOW_HOURS = 12;
/**
 * US focus: stories the desk marked as of little interest to American readers (another country's
 * local market data, a foreign retailer's debts, a UK NHS update) keep only this share of their
 * score. They aren't dropped, so a quiet hour still fills 10.
 */
const NOT_US_WEIGHT = 0.4;

export interface IngestDeps {
  fetch?: typeof fetchArticles;
  synthesize?: typeof synthesizeCategory;
  dedupe?: typeof findDuplicateGroups;
  trends?: () => Promise<Trend[]>;
  googleNews?: () => Promise<GoogleStory[]>;
  translate?: typeof translateStories;
}

export async function runHourlyIngest(opts: { now?: Date; hour?: Date; deps?: IngestDeps } = {}): Promise<IngestResult> {
  const fetchFn = opts.deps?.fetch ?? fetchArticles;
  const synthesizeFn = opts.deps?.synthesize ?? synthesizeCategory;
  const dedupeFn = opts.deps?.dedupe ?? findDuplicateGroups;
  // Tests that stub the feeds also stay off the network for Trends unless they pass their own.
  const trendsFn = opts.deps?.trends ?? (opts.deps?.fetch ? async () => [] : fetchTrends);
  const googleNewsFn = opts.deps?.googleNews ?? (opts.deps?.fetch ? async () => [] : fetchGoogleNews);
  const translateFn = opts.deps?.translate ?? (opts.deps?.fetch ? null : translateStories);
  const started = Date.now();
  const now = opts.now ?? new Date();
  const hour = opts.hour ?? targetHourFor(now);
  const key = toHourKey(hour);
  // Scheduled runs only publish inside the publishing day (5 AM to midnight, display zone).
  // An explicit `hour` (manual backfill) is always honoured.
  if (!opts.hour && !isEditionHour(hour)) {
    return { hour: key, storage: await storageMode(), articleCount: 0, clusterCount: 0, storyCounts: { tech: 0, finance: 0, politics: 0, world: 0, health: 0 }, feedErrors: [], status: "skipped_off_hours", durationMs: Date.now() - started };
  }
  const base = { hour: key, storage: await storageMode(), articleCount: 0, clusterCount: 0, storyCounts: { tech: 0, finance: 0, politics: 0, world: 0, health: 0 }, feedErrors: [] };

  // Hour files are immutable.
  if (await editionExists(key)) return { ...base, status: "skipped_already_published", durationMs: Date.now() - started };

  // 1. Fetch whitelisted feeds (last 4 hours).
  //    Google Trends is read alongside, as a ranking signal only.
  //    So are Google News top stories (ranking check only).
  const [{ articles, feedErrors }, trends, googleNews] = await Promise.all([
    fetchFn(now, WINDOW_HOURS),
    trendsFn().catch(() => [] as Trend[]),
    googleNewsFn().catch(() => [] as GoogleStory[]),
  ]);
  if (articles.length === 0) return { ...base, status: "skipped_no_articles", feedErrors, durationMs: Date.now() - started };

  // 2. Cluster by headline similarity, then let Gemini merge same-event clusters (one request)
  //    among the top 25 candidates per category, re-score velocity, keep top 10.
  const lexical = clusterArticles(articles);
  const candidates = selectTopClusters(lexical, now, 25);
  //    The same request re-files each candidate by content (general feeds mix topics) and
  //    drops off-topic ones (sport, entertainment...).
  const desk = await dedupeFn(candidates);
  // Stories the desk judged of little interest to US readers in their section rank lower.
  const notUs = new Set(desk.notUs ?? []);
  const candidateIds = new Set(CATEGORIES.flatMap((c) => candidates[c].map((x) => x.id)));
  const kept = lexical.filter((c) => candidateIds.has(c.id) && desk.categories[c.id] !== "other");
  for (const c of kept) {
    const cat = desk.categories[c.id];
    if (cat && cat !== "other") c.category = cat;
  }
  // Remember where each candidate article was filed, so the backfill below can't put it back.
  const filedAs = new Map<string, string>();
  for (const c of lexical) {
    if (!candidateIds.has(c.id)) continue;
    const where = desk.categories[c.id] ?? c.category;
    for (const a of c.articles) filedAs.set(a.url, where);
  }
  const modelMerged = mergeClusters(kept, desk.groups);
  const clusters: Cluster[] = mergeClusters(modelMerged, sameEventGroups(modelMerged));
  const pool = selectTopClusters(clusters, now, 25);

  // 3. Freshness: match candidates to last hour's Top 10. First-time stories get a boost,
  //    stories past their grace period (3h by default) decay. Then cut to the final 10.
  const previous = await readPreviousEdition(hour);
  const top = {} as Record<Category, Cluster[]>;
  const prevFor = new Map<Cluster, Story | null>();
  for (const category of CATEGORIES) {
    const cands = pool[category];
    const prevs = matchPrevious(cands, previous?.stories[category] ?? []);
    const adjusted = cands.map((c, i) => {
      prevFor.set(c, prevs[i]);
      // Stories people are searching for on Google right now rank higher.
      // ...and so do stories Google News is featuring right now.
      return {
        c,
        s:
          c.score *
          freshnessMultiplier(hoursInTop(prevs[i], key)) *
          trendMultiplier(trendFor(c, trends)) *
          googleMultiplier(googleRankFor(c, googleNews)) *
          (notUs.has(c.id) ? NOT_US_WEIGHT : 1),
      };
    });
    adjusted.sort((a, b) => b.s - a.s || b.c.distinctOutlets - a.c.distinctOutlets || b.c.newestAt.getTime() - a.c.newestAt.getTime());
    top[category] = adjusted.slice(0, TOP_N + SPARES).map((x) => x.c);
  }

  // 3a. One tab per story: drop copies of the same article that landed in other categories.
  for (const [url, cat] of crossCategoryDedupe(top)) filedAs.set(url, cat);

  // 3b. Backfill: on a slow news hour (or when feeds fail) a category can have fewer than
  //     10 distinct stories in the 4h window. Widen to 12h for that category only and append
  //     the strongest stories that aren't already listed, so every list fills all 10 slots.
  //     A list counts as short when it can't cover its spares too, since duplicates and stories
  //     Gemini can't write are only removed later.
  const short = CATEGORIES.filter((c) => top[c].length < TOP_N + SPARES);
  if (short.length) {
    const wide = await fetchFn(now, BACKFILL_WINDOW_HOURS).catch(() => null);
    if (wide?.articles.length) {
      const extra = selectTopClusters(clusterArticles(wide.articles.filter((a) => short.includes(a.category))), now, 40);
      for (const category of short) {
        const listed = top[category];
        const usedUrls = new Set(listed.flatMap((c) => c.articles.map((a) => a.url)));
        const fresh = extra[category].filter(
          (c) =>
            !c.articles.some((a) => usedUrls.has(a.url) || (filedAs.has(a.url) && filedAs.get(a.url) !== category)) &&
            !listed.some((l) => overlap(c.tokens, l.tokens, 3) >= 0.5),
        );
        const add = fresh.slice(0, TOP_N + SPARES - listed.length);
        const claimed = new Set([...prevFor.values()].filter(Boolean));
        const prevs = matchPrevious(add, (previous?.stories[category] ?? []).filter((p) => !claimed.has(p)));
        add.forEach((c, i) => prevFor.set(c, prevs[i]));
        top[category] = [...listed, ...add];
      }
    }
  }

  // 4. Gemini write-ups: one request per category, in parallel (5 requests, plus a retry of
  //    only the missing stories if needed). A story Gemini couldn't write is left out; a category
  //    with nothing written keeps the previous edition's list, so one bad answer never blocks the hour.
  const fallbackCategories: Category[] = [];
  const matched = new Set<string>();
  let googleMatched = 0;
  let wroteAny = false;
  const entries = await Promise.all(
    CATEGORIES.map(async (category) => {
      const all = top[category];
      const written: (Synthesis | null)[] = await synthesizeFn(category, all).catch((err) => {
        console.warn(`[synthesize:${category}] gave up:`, err instanceof Error ? err.message : err);
        return all.map(() => null);
      });
      // Fold any repeated stories together, then keep the best 10 (spares fill freed slots).
      const sameAs = new Map<Cluster, Cluster>();
      written.forEach((t, i) => t?.sameAs != null && sameAs.set(all[i], all[t.sameAs]));
      const deduped = dedupeWritten(all.filter((_, i) => written[i]), written.filter((t): t is Synthesis => Boolean(t)), prevFor, sameAs);
      const ranked = deduped.clusters.slice(0, TOP_N);
      const texts = deduped.texts.slice(0, TOP_N);
      if (all.length && !ranked.length) {
        fallbackCategories.push(category);
        const kept = (previous?.stories[category] ?? []).map<Story>((s) => ({ ...s, id: `${key}-${category}-${s.rank}`, rankChange: "=", hot: undefined }));
        return [category, kept] as const;
      }
      if (ranked.length) wroteAny = true;
      const changes = ranked.map((c, i) => formatRankChange(prevFor.get(c)?.rank ?? null, i + 1, previous != null));
      googleMatched += ranked.filter((c) => googleRankFor(c, googleNews) != null).length;
      const trending = ranked.map((c) => trendFor(c, trends));
      trending.forEach((t) => t && matched.add(t.query));
      const hot = pickHot(ranked, changes, now, trending.map((t) => t?.rank ?? null), ranked.map((c) => prevFor.get(c)?.rank ?? null));
      const stories = ranked.map<Story>((c, i) => ({
        id: `${key}-${category}-${i + 1}`,
        category,
        rank: i + 1,
        rankChange: changes[i],
        ...(hot[i] ? { hot: true } : {}),
        storyKey: prevFor.get(c)?.storyKey ?? randomUUID(),
        firstSeen: firstSeenFor(prevFor.get(c) ?? null, key),
        headline: texts[i].headline,
        summary: texts[i].summary,
        whyItMatters: texts[i].whyItMatters,
        ...(texts[i].i18n && Object.keys(texts[i].i18n!).length ? { i18n: texts[i].i18n } : {}),
        sources: pickSources(c),
      }));
      return [category, stories] as const;
    }),
  );

  // Nothing written anywhere (e.g. Gemini quota used up): keep the current edition live.
  if (!wroteAny) throw new Error("Gemini wrote no stories for any category; nothing published");

  // 4b. Japanese, German, French, Korean and Portuguese: one request per freshly written
  //     category, one at a time (stays under the per-minute limit). A failure leaves English.
  if (translateFn) {
    for (const [category, stories] of entries) {
      if (!stories.length || fallbackCategories.includes(category)) continue;
      const extra = await translateFn(category, stories).catch(() => []);
      stories.forEach((s, i) => {
        if (extra[i] && Object.keys(extra[i]).length) s.i18n = { ...s.i18n, ...extra[i] };
      });
    }
  }

  // 5. Publish: hour file + index + latest.json. Readers see it from :00.
  const edition: Edition = {
    key,
    snapshotHour: hour.toISOString(),
    generatedAt: new Date().toISOString(),
    stories: Object.fromEntries(entries) as Edition["stories"],
  };
  const created = await publishEdition(edition);

  return {
    ...base,
    status: created ? "published" : "skipped_already_published",
    fallbackCategories,
    articleCount: articles.length,
    clusterCount: clusters.length,
    storyCounts: Object.fromEntries(entries.map(([c, list]) => [c, list.length])) as Record<Category, number>,
    feedErrors,
    trends: { fetched: trends.length, matched: [...matched] },
    googleNews: { fetched: googleNews.length, matched: googleMatched },
    durationMs: Date.now() - started,
  };
}
