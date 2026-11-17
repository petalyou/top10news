import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { castVote, editionOpen, MAX_VOTES_PER_ADDRESS, readCounts, type D1Like, type D1Stmt } from "../lib/votes";

/** Minimal D1 stand-in over Node's built-in SQLite. */
function fakeD1(): D1Like {
  const db = new DatabaseSync(":memory:");
  const stmt = (sql: string, args: unknown[] = []): D1Stmt => ({
    bind: (...v: unknown[]) => stmt(sql, v),
    first: async <T,>() => (db.prepare(sql).get(...(args as never[])) as T) ?? null,
    all: async <T,>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    run: async () => db.prepare(sql).run(...(args as never[])),
  });
  return { prepare: (sql) => stmt(sql) };
}

const now = new Date("2026-11-17T02:20:00Z");
const ed = "2026-11-17-02";
const s1 = `${ed}-finance-1`;
const v = (voter: string, value: -1 | 0 | 1, story = s1, addr = "a1") => ({ edition: ed, story, voter, addr, value });

test("votes: one per browser per story, can change or undo, counts shared", async () => {
  const db = fakeD1();
  assert.deepEqual(await castVote(db, v("browser-aaaa", 1), now), { ok: true, counts: { up: 1, down: 0 } });
  assert.deepEqual(await castVote(db, v("browser-aaaa", 1), now), { ok: true, counts: { up: 1, down: 0 } }); // same vote twice
  assert.deepEqual(await castVote(db, v("browser-bbbb", 1, s1, "a2"), now), { ok: true, counts: { up: 2, down: 0 } });
  assert.deepEqual(await castVote(db, v("browser-aaaa", -1), now), { ok: true, counts: { up: 1, down: 1 } }); // changed mind
  assert.deepEqual(await castVote(db, v("browser-aaaa", 0), now), { ok: true, counts: { up: 1, down: 0 } }); // undone
  assert.deepEqual(await readCounts(db, ed), { [s1]: { up: 1, down: 0 } });
});

test("votes: only the live edition, valid ids, and a cap per network address", async () => {
  const db = fakeD1();
  assert.equal(editionOpen(ed, now), true);
  assert.equal(editionOpen("2026-11-17-01", now), true); // just turned over
  assert.equal(editionOpen("2026-11-16-23", now), false);
  assert.deepEqual(await castVote(db, { ...v("browser-aaaa", 1), edition: "2026-11-16-23", story: "2026-11-16-23-finance-1" }, now), { ok: false, status: 409, error: "voting is closed for this edition" });
  assert.equal((await castVote(db, v("x", 1), now)).ok, false); // voter id too short
  assert.equal((await castVote(db, v("browser-aaaa", 1, "other-story"), now)).ok, false);
  for (let i = 0; i < MAX_VOTES_PER_ADDRESS; i++) assert.equal((await castVote(db, v(`spammer-${String(i).padStart(4, "0")}`, 1, s1, "same-addr"), now)).ok, true);
  assert.deepEqual(await castVote(db, v("spammer-last", 1, s1, "same-addr"), now), { ok: false, status: 429, error: "too many votes" });
});
