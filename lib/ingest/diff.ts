import { randomUUID } from "node:crypto";
import type { Story } from "../types";
import type { Cluster } from "./cluster";
import { overlap, tokens } from "./text";

export interface RankMatch {
  rankChange: string;
  storyKey: string;
}

/** Minimum headline-token overlap to treat a cluster as the same event as last hour. */
const MATCH_THRESHOLD = 0.5;

export function formatRankChange(prevRank: number | null, newRank: number, hasPrevious = true): string {
  // With no earlier edition to compare against (the very first one), nothing is "new".
  if (!hasPrevious) return "";
  if (prevRank == null) return "NEW";
  const delta = prevRank - newRank; // moved up => positive
  if (delta === 0) return "=";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function storyTokens(s: Story): Set<string> {
  const t = tokens(s.headline);
  for (const src of s.sources) tokens(src.title).forEach((x) => t.add(x));
  return t;
}

/**
 * Match clusters (same category) against last hour's stories.
 * A shared source URL is a definitive match; otherwise the best token overlap wins.
 * Each previous story can be claimed once. Returns the matched previous story or null.
 */
export function matchPrevious(clusters: Cluster[], previous: Story[]): (Story | null)[] {
  const prevTokens = previous.map(storyTokens);
  const prevUrls = previous.map((s) => new Set(s.sources.map((x) => x.url)));
  const claimed = new Set<number>();

  // Score all pairs, then assign greedily by strength so the strongest matches win.
  const pairs: { ci: number; pi: number; sim: number }[] = [];
  clusters.forEach((c, ci) => {
    const urls = c.articles.map((a) => a.url);
    previous.forEach((_, pi) => {
      const sharedUrl = urls.some((u) => prevUrls[pi].has(u));
      const sim = sharedUrl ? 2 : overlap(c.tokens, prevTokens[pi], 3);
      if (sim >= MATCH_THRESHOLD) pairs.push({ ci, pi, sim });
    });
  });
  pairs.sort((a, b) => b.sim - a.sim);

  const matchFor = new Map<number, number>();
  for (const p of pairs) {
    if (matchFor.has(p.ci) || claimed.has(p.pi)) continue;
    matchFor.set(p.ci, p.pi);
    claimed.add(p.pi);
  }
  return clusters.map((_, ci) => {
    const pi = matchFor.get(ci);
    return pi == null ? null : previous[pi];
  });
}

/** Rank change + carried story key for already-ranked clusters (index = rank - 1). */
export function diffAgainstPrevious(ranked: Cluster[], previous: Story[]): RankMatch[] {
  return matchPrevious(ranked, previous).map((prev, ci) => ({
    rankChange: formatRankChange(prev?.rank ?? null, ci + 1),
    storyKey: prev?.storyKey ?? randomUUID(),
  }));
}
