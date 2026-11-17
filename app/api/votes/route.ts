import { NextResponse } from "next/server";
import { castVote, hashAddress, readCounts, type D1Like } from "@/lib/votes";

export const dynamic = "force-dynamic";

/** The D1 database bound as VOTES, only inside the Workers runtime. Null means counts are off. */
async function votesDb(): Promise<D1Like | null> {
  if (typeof navigator === "undefined" || navigator.userAgent !== "Cloudflare-Workers") return null;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as Record<string, unknown>).VOTES as D1Like | undefined) ?? null;
  } catch {
    return null;
  }
}

const noStore = { "cache-control": "no-store" };

/** GET /api/votes?edition=YYYY-MM-DD-HH -> { enabled, counts: { storyId: { up, down } } } */
export async function GET(req: Request) {
  const edition = new URL(req.url).searchParams.get("edition") ?? "";
  const db = await votesDb();
  if (!db || !/^\d{4}-\d{2}-\d{2}-\d{2}$/.test(edition)) return NextResponse.json({ enabled: Boolean(db), counts: {} }, { headers: noStore });
  try {
    return NextResponse.json({ enabled: true, counts: await readCounts(db, edition) }, { headers: noStore });
  } catch (err) {
    console.error("[votes] read failed", err);
    return NextResponse.json({ enabled: false, counts: {} }, { headers: noStore });
  }
}

/** POST /api/votes { edition, story, voter, vote: "up" | "down" | null } -> { counts: { up, down } } */
export async function POST(req: Request) {
  // Only from our own pages.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = await votesDb();
  if (!db) return NextResponse.json({ error: "votes are not set up" }, { status: 503 });

  let body: { edition?: unknown; story?: unknown; voter?: unknown; vote?: unknown };
  try {
    const text = await req.text();
    if (text.length > 500) throw new Error("too large");
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const edition = String(body.edition ?? "");
  const value = body.vote === "up" ? 1 : body.vote === "down" ? -1 : body.vote == null ? 0 : NaN;
  if (Number.isNaN(value)) return NextResponse.json({ error: "bad vote" }, { status: 400 });
  const addr = await hashAddress(req.headers.get("cf-connecting-ip") ?? "unknown", edition);
  try {
    const r = await castVote(db, { edition, story: String(body.story ?? ""), voter: String(body.voter ?? ""), addr, value: value as -1 | 0 | 1 });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });
    return NextResponse.json({ counts: r.counts }, { headers: noStore });
  } catch (err) {
    console.error("[votes] write failed", err);
    return NextResponse.json({ error: "could not save vote" }, { status: 500 });
  }
}
