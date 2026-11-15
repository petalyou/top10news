import type { Story } from "../types";
import type { Cluster } from "./cluster";
import type { Synthesis } from "./synthesize";
import { jaccard, tokens } from "./text";

/** Two written headlines describe the same story: identical once normalised, or nearly so. */
export function sameHeadline(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (norm(a) === norm(b)) return true;
  return jaccard(tokens(a), tokens(b)) >= 0.6;
}

/**
 * Last line of defence after the write-ups: if two stories in a category came out with the same
 * (or near-same) headline, or carry the same story identity, fold the lower one into the higher
 * one. The merged story keeps the better rank, the union of sources, and the identity with the
 * earlier firstSeen (so it isn't wrongly labelled NEW). Callers then cut to 10, so a spare
 * candidate fills the freed slot.
 */
export function dedupeWritten(clusters: Cluster[], texts: Synthesis[], prevFor: Map<Cluster, Story | null>) {
  const outC: Cluster[] = [];
  const outT: Synthesis[] = [];
  clusters.forEach((c, i) => {
    const t = texts[i];
    const key = prevFor.get(c)?.storyKey;
    const j = outT.findIndex((o, k) => sameHeadline(o.headline, t.headline) || (key != null && prevFor.get(outC[k])?.storyKey === key));
    if (j < 0) {
      outC.push(c);
      outT.push(t);
      return;
    }
    const keep = outC[j];
    const seen = new Set(keep.articles.map((a) => a.url));
    const articles = [...keep.articles, ...c.articles.filter((a) => !seen.has(a.url))];
    const merged: Cluster = {
      ...keep,
      articles,
      tokens: new Set([...keep.tokens, ...c.tokens]),
      distinctOutlets: new Set(articles.map((a) => a.outlet)).size,
      newestAt: new Date(Math.max(keep.newestAt.getTime(), c.newestAt.getTime())),
    };
    const candidates = [prevFor.get(keep), prevFor.get(c)].filter((p): p is Story => Boolean(p));
    candidates.sort((x, y) => (x.firstSeen ?? "").localeCompare(y.firstSeen ?? ""));
    prevFor.set(merged, candidates[0] ?? null);
    outC[j] = merged;
  });
  return { clusters: outC, texts: outT };
}
