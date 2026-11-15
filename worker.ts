/**
 * Cloudflare Worker entry point.
 * - fetch: the Next.js site, built by `opennextjs-cloudflare build` into .open-next/.
 * - scheduled: the Cron Trigger in wrangler.toml (minute 40 of every hour).
 *   Free plan: asks GitHub to start the "Hourly ingest" workflow (lib/github-dispatch.ts), a
 *   backup for GitHub's unreliable schedule. Needs Worker secrets GH_DISPATCH_TOKEN and GH_REPO.
 *   Paid plan: with CRON_SECRET set instead, runs the ingest in-process through the site's own
 *   /api/cron/hourly-ingest route.
 */
// @ts-ignore: generated at build time by `opennextjs-cloudflare build`
import { default as handler } from "./.open-next/worker.js";
import { dispatchConfigured, dispatchIngest, type DispatchEnv } from "./lib/github-dispatch";

interface Env extends DispatchEnv {
  CRON_SECRET?: string;
  SITE_URL?: string;
  [key: string]: unknown;
}

export default {
  fetch: handler.fetch,

  async scheduled(controller: { cron: string; scheduledTime: number }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (dispatchConfigured(env)) {
      const run = dispatchIngest(env).then((r) => {
        console.log(`[cron ${controller.cron}] GitHub dispatch: ${r.status} ${r.detail}`);
        if (!r.ok) throw new Error(`GitHub dispatch failed: ${r.status}`);
      });
      ctx.waitUntil(run);
      await run;
      return;
    }
    if (!env.CRON_SECRET) {
      console.error("[cron] set GH_DISPATCH_TOKEN + GH_REPO (free plan) or CRON_SECRET (paid plan); skipping");
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
