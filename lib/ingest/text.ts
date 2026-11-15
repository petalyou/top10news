/** Lightweight text similarity used for clustering and hour-over-hour matching. */

const STOPWORDS = new Set(
  `a an the and or but if of to in on at by for with from as into over under about after before amid
  is are was were be been being has have had do does did will would can could should may might must
  this that these those it its it's he she they them his her their our we you your i me my
  not no new says said say report reports reported reportedly update live latest breaking news
  what why how who when where which than then there here up down out more most just also amid via vs
  first last year years week weeks day days today tomorrow yesterday time times one two three
  us u.s. inc co corp ltd plc`
    .split(/\s+/)
    .filter(Boolean),
);

function stem(t: string): string {
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 4 && t.endsWith("es") && /(sses|xes|ches|shes)$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

export function tokens(text: string): Set<string> {
  const out = new Set<string>();
  const cleaned = text
    .toLowerCase()
    .replace(/[’']s\b/g, "")
    .replace(/[^a-z0-9$%.\- ]+/g, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ");
  for (const raw of cleaned.split(/[\s-]+/)) {
    if (!raw || STOPWORDS.has(raw)) continue;
    if (raw.length < 2 && !/\d/.test(raw)) continue;
    out.add(stem(raw));
  }
  return out;
}

export function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (big.has(t)) n++;
  return n;
}

/** Jaccard similarity |A∩B| / |A∪B|: low when two headlines share names but say different things. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const n = intersectionSize(a, b);
  return n / (a.size + b.size - n);
}

/**
 * Two headlines report the same event: their wording mostly matches overall (Jaccard >= 0.45), or
 * one is nearly contained in the other with 4+ shared words. Sharing only the names
 * ("Nvidia", "Jensen Huang", "resign") is not enough, so a follow-up such as executives rallying
 * behind Huang stays apart from the resignation itself. Returns 0 when not the same event.
 */
export function eventSimilarity(a: Set<string>, b: Set<string>): number {
  const n = intersectionSize(a, b);
  if (n < 2) return 0;
  const j = n / (a.size + b.size - n);
  const m = n / Math.min(a.size, b.size);
  return j >= 0.45 || (n >= 4 && m >= 0.75) ? Math.max(j, m) : 0;
}

/** Overlap coefficient |A∩B| / min(|A|,|B|), requiring at least `minShared` shared tokens. */
export function overlap(a: Set<string>, b: Set<string>, minShared = 2): number {
  if (!a.size || !b.size) return 0;
  const n = intersectionSize(a, b);
  if (n < minShared) return 0;
  return n / Math.min(a.size, b.size);
}
