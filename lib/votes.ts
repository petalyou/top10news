/**
 * Thumbs up/down counts, shared by all readers, for the live edition only. Stored in Cloudflare D1
 * (free tier). Each vote is one row keyed by edition, story and the reader's browser id, so a
 * browser has one vote per story and can change or undo it. Rows older than a few hours are
 * deleted, so nothing is kept long term. Basic spam protection: a cap on votes per network
 * address per edition, and only the live edition (or the one just before it) accepts votes.
 */
import { addHours, toHourKey, truncateToHour } from "./hour";

export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface D1Like {
  prepare(sql: string): D1Stmt;
}

export type Counts = Record<string, { up: number; down: number }>;

/** Votes one network address may cast per edition (all stories together). */
export const MAX_VOTES_PER_ADDRESS = 120;
/** Rows older than this are deleted. */
const KEEP_MS = 6 * 3_600_000;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS votes (
    edition TEXT NOT NULL, story TEXT NOT NULL, voter TEXT NOT NULL, addr TEXT NOT NULL,
    value INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (edition, story, voter))`,
  `CREATE INDEX IF NOT EXISTS votes_addr ON votes (edition, addr)`,
  `CREATE INDEX IF NOT EXISTS votes_at ON votes (at)`,
];
const ready = new WeakSet<object>();
async function ensureSchema(db: D1Like) {
  if (ready.has(db)) return;
  for (const sql of SCHEMA) await db.prepare(sql).run();
  ready.add(db);
}

const EDITION_RE = /^\d{4}-\d{2}-\d{2}-\d{2}$/;
const VOTER_RE = /^[A-Za-z0-9-]{8,64}$/;

/** Votes are accepted for the current hour's edition and the one before it (readers mid-read at :00). */
export function editionOpen(edition: string, now = new Date()): boolean {
  if (!EDITION_RE.test(edition)) return false;
  const current = toHourKey(truncateToHour(now));
  const previous = toHourKey(addHours(truncateToHour(now), -1));
  return edition === current || edition === previous;
}

export function validStory(edition: string, story: string): boolean {
  return story.startsWith(`${edition}-`) && story.length <= 80 && /^[A-Za-z0-9-]+$/.test(story);
}

export async function readCounts(db: D1Like, edition: string, story?: string): Promise<Counts> {
  await ensureSchema(db);
  const sql = `SELECT story, SUM(CASE WHEN value > 0 THEN 1 ELSE 0 END) AS up, SUM(CASE WHEN value < 0 THEN 1 ELSE 0 END) AS down
    FROM votes WHERE edition = ?${story ? " AND story = ?" : ""} GROUP BY story`;
  const { results } = await db.prepare(sql).bind(...(story ? [edition, story] : [edition])).all<{ story: string; up: number; down: number }>();
  const out: Counts = {};
  for (const r of results) out[r.story] = { up: Number(r.up) || 0, down: Number(r.down) || 0 };
  return out;
}

export type VoteResult = { ok: true; counts: { up: number; down: number } } | { ok: false; status: number; error: string };

export async function castVote(
  db: D1Like,
  input: { edition: string; story: string; voter: string; addr: string; value: -1 | 0 | 1 },
  now = new Date(),
): Promise<VoteResult> {
  const { edition, story, voter, addr, value } = input;
  if (!editionOpen(edition, now)) return { ok: false, status: 409, error: "voting is closed for this edition" };
  if (!validStory(edition, story) || !VOTER_RE.test(voter) || ![-1, 0, 1].includes(value)) return { ok: false, status: 400, error: "bad vote" };
  await ensureSchema(db);

  if (value === 0) {
    await db.prepare(`DELETE FROM votes WHERE edition = ? AND story = ? AND voter = ?`).bind(edition, story, voter).run();
  } else {
    const existing = await db.prepare(`SELECT value FROM votes WHERE edition = ? AND story = ? AND voter = ?`).bind(edition, story, voter).first();
    if (!existing) {
      const used = await db.prepare(`SELECT COUNT(*) AS n FROM votes WHERE edition = ? AND addr = ?`).bind(edition, addr).first<{ n: number }>();
      if (Number(used?.n ?? 0) >= MAX_VOTES_PER_ADDRESS) return { ok: false, status: 429, error: "too many votes" };
    }
    await db
      .prepare(
        `INSERT INTO votes (edition, story, voter, addr, value, at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (edition, story, voter) DO UPDATE SET value = excluded.value, at = excluded.at`,
      )
      .bind(edition, story, voter, addr, value, now.getTime())
      .run();
  }
  // Housekeeping now and then: drop old editions' votes.
  if (Math.random() < 0.05) await db.prepare(`DELETE FROM votes WHERE at < ?`).bind(now.getTime() - KEEP_MS).run();

  const counts = (await readCounts(db, edition, story))[story] ?? { up: 0, down: 0 };
  return { ok: true, counts };
}

/** Short one-way hash of the reader's network address, so raw addresses are never stored. */
export async function hashAddress(ip: string, edition: string): Promise<string> {
  const data = new TextEncoder().encode(`top10-votes|${edition}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}
