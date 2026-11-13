import { TIER_WEIGHT } from "../feeds";
import type { Category } from "../types";
import type { Article } from "./fetch";
import { overlap, tokens } from "./text";

export interface Cluster {
  id: string;
  category: Category;
  articles: Article[];
  /** Union of member title tokens. */
  tokens: Set<string>;
  score: number;
  distinctOutlets: number;
  newestAt: Date;
}

/** Article-to-article similarity needed to join a cluster. */
const JOIN_THRESHOLD = 0.5;
/** Minimum similarity to the cluster seed, which stops single-link chaining drift. */
const SEED_THRESHOLD = 0.34;

/** Velocity window: outlets that covered the story in the last 90 minutes count fully. */
const VELOCITY_MINUTES = 90;
/** Older coverage inside the 4h fetch window still counts, discounted. */
const STALE_WEIGHT = 0.35;

/**
 * Greedy agglomerative clustering on headline tokens, per category.
 * Articles are seeded from the highest-tier, newest coverage first.
 */
export function clusterArticles(articles: Article[]): Cluster[] {
  const byCategory = new Map<Category, Article[]>();
  for (const a of articles) {
    const list = byCategory.get(a.category) ?? [];
    list.push(a);
    byCategory.set(a.category, list);
  }

  const clusters: Cluster[] = [];
  let seq = 0;

  for (const [category, list] of byCategory) {
    const ordered = [...list].sort((a, b) => a.tier - b.tier || b.publishedAt.getTime() - a.publishedAt.getTime());
    const local: { seed: Set<string>; members: { a: Article; t: Set<string> }[] }[] = [];

    for (const a of ordered) {
      const t = tokens(a.title);
      if (t.size === 0) continue;
      let best = -1;
      let bestSim = 0;
      local.forEach((c, i) => {
        if (overlap(t, c.seed) < SEED_THRESHOLD) return;
        const sim = Math.max(...c.members.map((m) => overlap(t, m.t)));
        if (sim >= JOIN_THRESHOLD && sim > bestSim) {
          best = i;
          bestSim = sim;
        }
      });
      if (best >= 0) local[best].members.push({ a, t });
      else local.push({ seed: t, members: [{ a, t }] });
    }

    for (const c of local) {
      const union = new Set<string>();
      c.members.forEach((m) => m.t.forEach((x) => union.add(x)));
      clusters.push({
        id: `k${++seq}`,
        category,
        articles: c.members.map((m) => m.a),
        tokens: union,
        score: 0,
        distinctOutlets: new Set(c.members.map((m) => m.a.outlet)).size,
        newestAt: new Date(Math.max(...c.members.map((m) => m.a.publishedAt.getTime()))),
      });
    }
  }
  return clusters;
}

/**
 * Velocity score: sum over distinct outlets of tier weight, full weight for
 * coverage in the last 90 minutes, discounted for older coverage.
 */
export function scoreCluster(c: Cluster, now: Date): number {
  const bestByOutlet = new Map<string, number>();
  for (const a of c.articles) {
    const ageMin = (now.getTime() - a.publishedAt.getTime()) / 60_000;
    const w = TIER_WEIGHT[a.tier] * (ageMin <= VELOCITY_MINUTES ? 1 : STALE_WEIGHT);
    bestByOutlet.set(a.outlet, Math.max(bestByOutlet.get(a.outlet) ?? 0, w));
  }
  let score = 0;
  for (const w of bestByOutlet.values()) score += w;
  // Small freshness tiebreaker (< 1 point) so equal clusters favour the newest.
  const newestAgeMin = (now.getTime() - c.newestAt.getTime()) / 60_000;
  return score + Math.max(0, 1 - newestAgeMin / 240) * 0.5;
}

/** Score every cluster and return the top `n` per category, ranked. */
export function selectTopClusters(clusters: Cluster[], now: Date, n = 10): Record<Category, Cluster[]> {
  for (const c of clusters) c.score = scoreCluster(c, now);
  const out: Record<Category, Cluster[]> = { tech: [], finance: [], politics: [], world: [] };
  for (const c of clusters) out[c.category].push(c);
  for (const cat of Object.keys(out) as Category[]) {
    out[cat] = out[cat]
      .sort((a, b) => b.score - a.score || b.distinctOutlets - a.distinctOutlets || b.newestAt.getTime() - a.newestAt.getTime())
      .slice(0, n);
  }
  return out;
}

/** Up to `max` sources, one per outlet, highest tier first, for attribution badges. */
export function pickSources(c: Cluster, max = 5) {
  const seen = new Set<string>();
  const out: { outlet: string; url: string; title: string }[] = [];
  const ordered = [...c.articles].sort((a, b) => a.tier - b.tier || b.publishedAt.getTime() - a.publishedAt.getTime());
  for (const a of ordered) {
    if (seen.has(a.outlet)) continue;
    seen.add(a.outlet);
    out.push({ outlet: a.outlet, url: a.url, title: a.title });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Merge clusters that a second pass (LLM) judged to be the same event, e.g.
 * "Nvidia stock plunges after CEO exit" + "Nvidia shares tumble on Huang resignation",
 * which share too few words for lexical matching. `groups` holds cluster ids.
 */
export function mergeClusters(clusters: Cluster[], groups: string[][]): Cluster[] {
  const byId = new Map(clusters.map((c) => [c.id, c]));
  const absorbed = new Set<string>();
  const merged: Cluster[] = [];

  for (const g of groups) {
    const members = [...new Set(g)].map((id) => byId.get(id)).filter((c): c is Cluster => Boolean(c) && !absorbed.has(c!.id));
    if (members.length < 2 || new Set(members.map((m) => m.category)).size > 1) continue;
    members.forEach((m) => absorbed.add(m.id));
    const [head, ...rest] = members;
    const articles = [...head.articles];
    const seenUrls = new Set(articles.map((a) => a.url));
    for (const r of rest) for (const a of r.articles) if (!seenUrls.has(a.url)) (seenUrls.add(a.url), articles.push(a));
    const tokenUnion = new Set<string>();
    members.forEach((m) => m.tokens.forEach((t) => tokenUnion.add(t)));
    merged.push({
      id: head.id,
      category: head.category,
      articles,
      tokens: tokenUnion,
      score: 0,
      distinctOutlets: new Set(articles.map((a) => a.outlet)).size,
      newestAt: new Date(Math.max(...articles.map((a) => a.publishedAt.getTime()))),
    });
  }
  return [...clusters.filter((c) => !absorbed.has(c.id)), ...merged];
}
