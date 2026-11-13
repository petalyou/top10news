/**
 * Cloudflare Worker entry point.
 * - fetch: the Next.js site, built by `opennextjs-cloudflare build` into .open-next/.
 * - scheduled: the Cron Trigger in wrangler.toml (minute 55 of every hour). It calls the
 *   site's own /api/cron/hourly-ingest route in-process, so the ingest code is shared with
 *   manual runs and backfills (`?hour=YYYY-MM-DD-HH`).
 */
// @ts-ignore: generated at build time by `opennextjs-cloudflare build`
import { default as handler } from "./.open-next/worker.js";

interface Env {
  CRON_SECRET?: string;
  SITE_URL?: string;
  [key: string]: unknown;
}

export default {
  fetch: handler.fetch,

  async scheduled(controller: { cron: string; scheduledTime: number }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (!env.CRON_SECRET) {
      console.error("[cron] CRON_SECRET is not set; skipping ingest");
      return;
    }
    const origin = (env.SITE_URL || "https://top10-hourly.internal").replace(/\/$/, "");
    const req = new Request(`${origin}/api/cron/hourly-ingest`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
    const run = (async () => {
      const res: Response = await handler.fetch(req, env, ctx);
      const body = await res.text();
      console.log(`[cron ${controller.cron}] ${res.status} ${body.slice(0, 500)}`);
      if (!res.ok) throw new Error(`hourly ingest failed: ${res.status}`);
    })();
    ctx.waitUntil(run);
    await run;
  },
};
