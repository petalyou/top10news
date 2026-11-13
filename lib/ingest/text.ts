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

/** Overlap coefficient |A∩B| / min(|A|,|B|), requiring at least `minShared` shared tokens. */
export function overlap(a: Set<string>, b: Set<string>, minShared = 2): number {
  if (!a.size || !b.size) return 0;
  const n = intersectionSize(a, b);
  if (n < minShared) return 0;
  return n / Math.min(a.size, b.size);
}
