/**
 * Snapshot storage: one JSON file per hour plus latest.json and index.json.
 *
 *   snapshots/YYYY-MM-DD-HH.json   immutable hour files (UTC keys)
 *   snapshots/latest.json          newest published edition
 *   snapshots/index.json           newest-first list of hour keys
 *
 * On Cloudflare (Workers via OpenNext) everything goes through the R2 bucket bound as
 * SNAPSHOTS in wrangler.toml. Anywhere else (next dev, tests, scripts) it falls back to
 * .data/ on local disk (kept out of public/ so it is never deployed as static files).
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Edition } from "./types";

export const LATEST_KEY = "snapshots/latest.json";
export const INDEX_KEY = "snapshots/index.json";
export const editionObjectKey = (hourKey: string) => `snapshots/${hourKey}.json`;

/** Keep the index to the last 90 days; older hour files stay reachable by URL. */
const INDEX_MAX = 24 * 90;

// ---------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------

interface Backend {
  mode: "r2" | "local";
  get(key: string): Promise<string | null>;
  exists(key: string): Promise<boolean>;
  put(key: string, body: string, cacheControl: string): Promise<void>;
}

/** Minimal shape of the Workers R2 binding we use. */
interface R2BucketLike {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  head(key: string): Promise<unknown | null>;
  put(key: string, body: string, opts?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
}

/** The SNAPSHOTS R2 binding when running on Cloudflare, otherwise null. */
async function r2Binding(): Promise<R2BucketLike | null> {
  // Only inside the Workers runtime. Under Node (next dev/start, scripts, CI), getCloudflareContext
  // can spin up a local simulated R2, which would split reads between it and .data.
  if (typeof navigator === "undefined" || navigator.userAgent !== "Cloudflare-Workers") return null;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as Record<string, unknown>).SNAPSHOTS as R2BucketLike | undefined) ?? null;
  } catch {
    return null; // not on Cloudflare (next dev, tests, scripts)
  }
}

function r2Backend(bucket: R2BucketLike): Backend {
  return {
    mode: "r2",
    async get(key) {
      const obj = await bucket.get(key);
      return obj ? obj.text() : null;
    },
    async exists(key) {
      return (await bucket.head(key)) != null;
    },
    async put(key, body, cacheControl) {
      await bucket.put(key, body, { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl } });
    },
  };
}

export function localDataDir(): string {
  return process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data");
}

/** Local disk (development and tests). */
function localBackend(): Backend {
  const file = (key: string) => path.join(/*turbopackIgnore: true*/ localDataDir(), key);
  return {
    mode: "local",
    async get(key) {
      try {
        return await readFile(/*turbopackIgnore: true*/ file(key), "utf8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async exists(key) {
      return stat(/*turbopackIgnore: true*/ file(key)).then(
        () => true,
        () => false,
      );
    },
    async put(key, body) {
      await mkdir(/*turbopackIgnore: true*/ path.dirname(file(key)), { recursive: true });
      await writeFile(/*turbopackIgnore: true*/ file(key), body, "utf8");
    },
  };
}

async function backend(): Promise<Backend> {
  const bucket = await r2Binding();
  return bucket ? r2Backend(bucket) : localBackend();
}

export const storageMode = async (): Promise<"r2" | "local"> => (await backend()).mode;

// ---------------------------------------------------------------------------
// Reads (site). A small per-isolate memory cache keeps R2 reads low:
// hour files never change; latest/index are re-read at most once a minute
// and whenever the hour rolls over, so a new edition shows right at :00.
// ---------------------------------------------------------------------------

const memo = new Map<string, { at: number; tag: string; value: unknown }>();
const MEMO_MAX = 64;

async function readJson<T>(key: string, opts: { ttlMs: number; tag?: string }): Promise<T | null> {
  const hit = memo.get(key);
  if (hit && hit.tag === (opts.tag ?? "") && Date.now() - hit.at < opts.ttlMs) return hit.value as T | null;
  const raw = await (await backend()).get(key);
  const value = raw ? (JSON.parse(raw) as T) : null;
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value!);
  memo.set(key, { at: Date.now(), tag: opts.tag ?? "", value });
  return value;
}

export function readLatest(currentHourKey: string) {
  return readJson<Edition>(LATEST_KEY, { ttlMs: 60_000, tag: currentHourKey });
}

export function readIndex(currentHourKey: string) {
  return readJson<string[]>(INDEX_KEY, { ttlMs: 60_000, tag: currentHourKey }).then((r) => r ?? []);
}

/** Hour files never change once written. */
export function readEdition(hourKey: string) {
  return readJson<Edition>(editionObjectKey(hourKey), { ttlMs: Infinity });
}

// ---------------------------------------------------------------------------
// Writes (ingest job). Always hit storage directly.
// ---------------------------------------------------------------------------

export async function readEditionUncached(hourKey: string): Promise<Edition | null> {
  const raw = await (await backend()).get(editionObjectKey(hourKey));
  return raw ? (JSON.parse(raw) as Edition) : null;
}

export async function editionExists(hourKey: string) {
  return (await backend()).exists(editionObjectKey(hourKey));
}

/**
 * Publish an edition: immutable hour file first, then index, then latest.json.
 * Returns false (and writes nothing) if that hour already exists.
 */
export async function publishEdition(edition: Edition): Promise<boolean> {
  const b = await backend();
  const key = editionObjectKey(edition.key);
  if (await b.exists(key)) return false;

  await b.put(key, JSON.stringify(edition), "public, max-age=31536000, immutable");

  const index: string[] = JSON.parse((await b.get(INDEX_KEY)) ?? "[]");
  const next = [...new Set([edition.key, ...index])].sort().reverse().slice(0, INDEX_MAX);
  await b.put(INDEX_KEY, JSON.stringify(next), "public, max-age=60");

  // latest.json only moves forward (a backfill of an old hour doesn't replace it).
  const latest: Edition | null = JSON.parse((await b.get(LATEST_KEY)) ?? "null");
  if (!latest || latest.key < edition.key) {
    await b.put(LATEST_KEY, JSON.stringify(edition), "public, max-age=60");
  }
  memo.delete(LATEST_KEY);
  memo.delete(INDEX_KEY);
  return true;
}
