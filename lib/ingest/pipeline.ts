import { addHours, isEditionHour, toHourKey, truncateToHour } from "../hour";
import { editionExists, publishEdition, readEditionUncached, storageMode } from "../storage";
import { CATEGORIES, type Category, type Edition, type Story } from "../types";
import { clusterArticles, mergeClusters, pickSources, selectTopClusters, type Cluster } from "./cluster";
import { overlap } from "./text";
import { randomUUID } from "node:crypto";
import { formatRankChange, matchPrevious } from "./diff";
import { firstSeenFor, freshnessMultiplier, hoursInTop } from "./freshness";
import { fetchArticles } from "./fetch";
import { findDuplicateGroups, synthesizeCategory } from "./synthesize";

export interface IngestResult {
  hour: string;
  status: "published" | "skipped_already_published" | "skipped_no_articles" | "skipped_off_hours";
  storage: "r2" | "local";
  articleCount: number;
  clusterCount: number;
  storyCounts: Record<Category, number>;
  feedErrors: { outlet: string; url: string; error: string }[];
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
/** Normal fetch window, and the wider window used only to backfill a category that came up short. */
const WINDOW_HOURS = 4;
const BACKFILL_WINDOW_HOURS = 12;

export interface IngestDeps {
  fetch?: typeof fetchArticles;
  synthesize?: typeof synthesizeCategory;
  dedupe?: typeof findDuplicateGroups;
}

export async function runHourlyIngest(opts: { now?: Date; hour?: Date; deps?: IngestDeps } = {}): Promise<IngestResult> {
  const fetchFn = opts.deps?.fetch ?? fetchArticles;
  const synthesizeFn = opts.deps?.synthesize ?? synthesizeCategory;
  const dedupeFn = opts.deps?.dedupe ?? findDuplicateGroups;
  const started = Date.now();
  const now = opts.now ?? new Date();
  const hour = opts.hour ?? targetHourFor(now);
  const key = toHourKey(hour);
  // Scheduled runs only publish inside the publishing day (5 AM to midnight, display zone).
  // An explicit `hour` (manual backfill) is always honoured.
  if (!opts.hour && !isEditionHour(hour)) {
    return { hour: key, storage: await storageMode(), articleCount: 0, clusterCount: 0, storyCounts: { tech: 0, finance: 0, politics: 0, world: 0 }, feedErrors: [], status: "skipped_off_hours", durationMs: Date.now() - started };
  }
  const base = { hour: key, storage: await storageMode(), articleCount: 0, clusterCount: 0, storyCounts: { tech: 0, finance: 0, politics: 0, world: 0 }, feedErrors: [] };

  // Hour files are immutable.
  if (await editionExists(key)) return { ...base, status: "skipped_already_published", durationMs: Date.now() - started };

  // 1. Fetch whitelisted feeds (last 4 hours).
  const { articles, feedErrors } = await fetchFn(now, WINDOW_HOURS);
  if (articles.length === 0) return { ...base, status: "skipped_no_articles", feedErrors, durationMs: Date.now() - started };

  // 2. Cluster by headline similarity, then let Gemini merge same-event clusters (one request)
  //    among the top 25 candidates per category, re-score velocity, keep top 10.
  const lexical = clusterArticles(articles);
  const candidates = selectTopClusters(lexical, now, 25);
  const groups = await dedupeFn(candidates);
  const candidateIds = new Set(CATEGORIES.flatMap((c) => candidates[c].map((x) => x.id)));
  const clusters: Cluster[] = mergeClusters(lexical.filter((c) => candidateIds.has(c.id)), groups);
  const pool = selectTopClusters(clusters, now, 25);

  // 3. Freshness: match candidates to last hour's Top 10. First-time stories get a boost,
  //    stories past their grace period (3h by default) decay. Then cut to the final 10.
  const previous = await readEditionUncached(toHourKey(addHours(hour, -1)));
  const top = {} as Record<Category, Cluster[]>;
  const prevFor = new Map<Cluster, Story | null>();
  for (const category of CATEGORIES) {
    const cands = pool[category];
    const prevs = matchPrevious(cands, previous?.stories[category] ?? []);
    const adjusted = cands.map((c, i) => {
      prevFor.set(c, prevs[i]);
      return { c, s: c.score * freshnessMultiplier(hoursInTop(prevs[i], key)) };
    });
    adjusted.sort((a, b) => b.s - a.s || b.c.distinctOutlets - a.c.distinctOutlets || b.c.newestAt.getTime() - a.c.newestAt.getTime());
    top[category] = adjusted.slice(0, TOP_N).map((x) => x.c);
  }

  // 3b. Backfill: on a slow news hour (or when feeds fail) a category can have fewer than
  //     10 distinct stories in the 4h window. Widen to 12h for that category only and append
  //     the strongest stories that aren't already listed, so every list fills all 10 slots.
  const short = CATEGORIES.filter((c) => top[c].length < TOP_N);
  if (short.length) {
    const wide = await fetchFn(now, BACKFILL_WINDOW_HOURS).catch(() => null);
    if (wide?.articles.length) {
      const extra = selectTopClusters(clusterArticles(wide.articles.filter((a) => short.includes(a.category))), now, 40);
      for (const category of short) {
        const listed = top[category];
        const usedUrls = new Set(listed.flatMap((c) => c.articles.map((a) => a.url)));
        const fresh = extra[category].filter(
          (c) => !c.articles.some((a) => usedUrls.has(a.url)) && !listed.some((l) => overlap(c.tokens, l.tokens, 3) >= 0.5),
        );
        const add = fresh.slice(0, TOP_N - listed.length);
        const claimed = new Set([...prevFor.values()].filter(Boolean));
        const prevs = matchPrevious(add, (previous?.stories[category] ?? []).filter((p) => !claimed.has(p)));
        add.forEach((c, i) => prevFor.set(c, prevs[i]));
        top[category] = [...listed, ...add];
      }
    }
  }

  // 4. Gemini write-ups: one request per category, in parallel (4 requests).
  const entries = await Promise.all(
    CATEGORIES.map(async (category) => {
      const ranked = top[category];
      const texts = await synthesizeFn(category, ranked);
      const stories = ranked.map<Story>((c, i) => ({
        id: `${key}-${category}-${i + 1}`,
        category,
        rank: i + 1,
        rankChange: formatRankChange(prevFor.get(c)?.rank ?? null, i + 1),
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
    articleCount: articles.length,
    clusterCount: clusters.length,
    storyCounts: Object.fromEntries(CATEGORIES.map((c) => [c, top[c].length])) as Record<Category, number>,
    feedErrors,
    durationMs: Date.now() - started,
  };
}
