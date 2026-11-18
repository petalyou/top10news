# Top 10 News Hourly

A "10-second grab-and-go" news site: every hour it locks the 10 most-covered stories in **Finance & Markets**, **Tech & AI**, **Politics**, **World** and **Health** into an immutable snapshot you can revisit with the Time Machine (`/?t=YYYY-MM-DD-HH`, UTC). No database, no accounts, no sign-ups.

**Gemini quota.** Each hourly run makes 11 requests (1 duplicate check + 1 write-up per category + 1 translation per category), about 220 a day over 20 daily editions. Flash-Lite's free tier allows roughly 15 requests/minute and 500/day. Don't switch `GEMINI_MODEL` to a Flash (non-Lite) model on the free tier: those allow only ~20 requests a day.

**Schedule and times.** Editions publish hourly from 5 AM through 12 AM (midnight) Eastern; there are none from 1 AM to 4 AM (`EDITION_TIMEZONE`, default `America/New_York`; hours in `lib/hour.ts`). The hourly job still runs every hour and simply skips the quiet hours (`skipped_off_hours`); a manual run for a specific hour always runs. Readers see every time in their own time zone; `NEXT_PUBLIC_DISPLAY_TIMEZONE` is only the fallback before the page loads in the browser.

**Stack:** Next.js 16 (App Router) + Tailwind CSS 4 on **Cloudflare Workers** (via `@opennextjs/cloudflare`) · hourly JSON snapshots in **Cloudflare R2** · a **GitHub Actions** hourly job (free plan) or a Worker Cron Trigger (paid) · Gemini Developer API (`gemini-3.5-flash-lite`, free tier, JSON-schema outputs).

## Quick start (local)

```bash
npm install
cp .env.example .env     # snapshots go to .data/ locally
npm run seed-demo        # optional: 3 placeholder editions, no API keys needed
npm run dev              # http://localhost:3000
```

Real data: set `GEMINI_API_KEY` (free at aistudio.google.com/apikey), then `npm run ingest` (builds and publishes the upcoming hour from live RSS feeds).

## Languages

English lives at `/`, with `/es` Spanish, `/zh` Simplified Chinese, `/ja` Japanese, `/de` German, `/fr` French, `/ko` Korean and `/pt` Brazilian Portuguese (all accept `?t=` and `?c=`). Interface strings are in `lib/i18n.ts`. Spanish and Chinese are written in the same Gemini call as the English; the other five come from one extra translation request per category, sent one at a time (`lib/ingest/translate.ts`). Translations are stored in `i18n.<lang>` on each story; a missing one falls back to English. Sponsors can add optional `i18n` overrides in `data/sponsors.json`. Legal pages are English-only and labeled as such.

## Storage layout

```
snapshots/YYYY-MM-DD-HH.json   immutable edition (Cache-Control: immutable, 1 year)
snapshots/latest.json          newest edition, overwritten hourly (max-age 60)
snapshots/index.json           ["2026-11-12-14", "2026-11-12-13", ...] newest first, last 90 days
```

Each edition file holds `{ key, snapshotHour, generatedAt, stories: { tech: [...], finance: [...], politics: [...] } }`; each story has `rank`, `rankChange` (`NEW` / `+N` / `-N` / `=`), `headline`, `summary`, `whyItMatters`, optional `i18n: { es, zh }` translations, `sources: [{ outlet, url, title }]` and a `storyKey` that follows the same event across hours.

On Cloudflare, reads and writes go through the R2 bucket bound as `SNAPSHOTS` (`wrangler.toml`); the bucket stays private, no public URL or API keys needed. Each Worker isolate keeps hour files in memory and re-reads `latest.json`/`index.json` at most once a minute and whenever the hour rolls over, so a new edition shows right at :00. Locally (`npm run dev`, tests, scripts) the same files live in `.data/`.

## How an hour is built (`/api/cron/hourly-ingest`, runs at :55)

1. **Fetch** ~40 whitelisted official RSS/Atom feeds (`lib/feeds.ts`), keeping items from the last 4 hours. Only headline, link, date and teaser are read; no article pages, paywalls or images. Domains in `OPTOUT_DOMAINS` are skipped.
2. **Cluster** headlines per category by token overlap, then one Gemini request (all categories at once) merges clusters that describe the same event in different words.
3. **Score velocity:** distinct outlets × source tier (tier 1 = 3, tier 2 = 2, tier 3 = 1), full weight for coverage in the last 90 minutes, 0.35× for older.
4. **Freshness + rank diff** against the previous hour's file (`lib/ingest/freshness.ts`). A story in the Top 10 for the first time gets ×1.25; stories keep full score for their first 3 hours in the Top 10, then lose 15% per extra hour (floor 0.4×), so new stories overtake stale ones while a still-exploding story can hold on. Each story records `firstSeen`. Tune with `RANK_NEW_BOOST`, `RANK_GRACE_HOURS`, `RANK_DECAY_PER_HOUR`, `RANK_DECAY_FLOOR`. Then the Top 10 is cut and marked `NEW`, `+N`, `-N`, `=`. If a category has fewer than 10 distinct stories in the 4-hour window (slow news hour, feed outage), that category is backfilled from a 12-hour window so every list fills all 10 slots.
5. **Synthesize** with Gemini, one request per category: neutral headline, 2 original sentences, one "Why it matters" line, plus Spanish and Simplified Chinese versions of all three (Japanese, German, French, Korean and Portuguese follow in a separate translation pass). Retries once on rate limits, then falls back to `gemini-3.1-flash-lite` (`GEMINI_FALLBACK_MODEL`); if both fail nothing is written and the previous edition stays live.
6. **Publish** the *next* hour's file, then `index.json`, then `latest.json`. The site only shows an edition once its hour has started, so it flips at :00. Existing hour files are never rewritten.

## Sponsors (`data/sponsors.json`)

All sponsor slots are **off by default**. Set `SHOW_SPONSORS = "true"` in `wrangler.toml` `[vars]` (or the Worker's Settings → Variables) and redeploy to show the "Presented by" banner, the Sponsored card and the "Sponsor this edition" fallback.

Each entry has `id`, `category` (`tech|finance|politics|all`), `slot_type` (`title_banner|native_briefing`), `sponsor_name`, `headline`, `summary`, optional `why_it_matters`, `cta_label`, `target_url`, `start_date`, `end_date` (inclusive, site time zone) and `is_active`. A category-specific booking beats an `all` booking. Edit the file and redeploy; `npm test` validates it.

- `title_banner` → the "Presented by" bar above story #1.
- `native_briefing` → an unranked, clearly labeled **SPONSORED** card between #3 and #4. With no booking, a low-key "Sponsor the … Edition →" link opens a pre-filled email to `SPONSOR_EMAIL`.
- Links use `target="_blank" rel="sponsored noopener noreferrer"`. There is no click tracking; put UTM parameters in `target_url` so sponsors can measure clicks in their own analytics.

Editorial rankings never read this file.

## Legal pages

`/terms`, `/privacy` and `/publishers` use the owner-supplied copy verbatim (English only). Settings live in `lib/config.ts`: `CONTACT_EMAIL` is the one address shown everywhere (optional overrides: `PRIVACY_EMAIL`, `PUBLISHERS_EMAIL`, `DMCA_EMAIL`, `HELLO_EMAIL`, `SPONSOR_EMAIL`), plus `LEGAL_ENTITY_NAME` (footer) and `LEGAL_EFFECTIVE_DATE`. These pages are prerendered at build time, so on Cloudflare set the same values as **build variables** in Workers Builds (or in your shell for `npm run deploy`).

## Deploy (Cloudflare free plan: Workers + R2, ingest on GitHub Actions)

- **Site:** one Worker named `top10-hourly` (see `wrangler.toml`), Next.js built with `@opennextjs/cloudflare`. It only reads from R2.
- **Snapshots:** R2 bucket `top10-hourly-snapshots`, bound as `SNAPSHOTS`.
- **Ingest:** `.github/workflows/hourly-ingest.yml` runs at :40 every hour (UTC), downloads `latest.json`/`index.json` from R2, builds the next hour's edition, and uploads it with `wrangler r2 object put`. A free Worker only gets 10 ms of CPU, too little to parse the feeds, so it doesn't run there. (On Workers Paid you can instead use the Worker Cron Trigger; see the comment in `wrangler.toml`.)

1. `npx wrangler login`, then `npx wrangler r2 bucket create top10-hourly-snapshots`.
2. Check `[vars]` in `wrangler.toml` (`SITE_URL`, `CONTACT_EMAIL`, …).
3. Deploy the site: `npm run deploy` (or connect the Git repo in **Workers & Pages → Create → Import a repository**, build `npx opennextjs-cloudflare build`, deploy `npx opennextjs-cloudflare deploy`).
4. Custom domain: Worker → **Settings → Domains & Routes → Add → Custom domain**.
5. Put this project in a GitHub repository (private is fine) and add three **repository secrets** (Settings → Secrets and variables → Actions): `GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` (Cloudflare → My Profile → API Tokens → Create token → custom token with **Account · Workers R2 Storage · Edit**).
6. First edition: GitHub → **Actions → Hourly ingest → Run workflow**. Logs are in the run.
7. Optional analytics: Cloudflare → **Web Analytics → Add a site** → your domain. If it gives you a JS snippet instead of enabling automatically, put its token in `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` in `.env` before `npm run deploy`. It is cookieless.

Local Workers runtime: `cp .dev.vars.example .dev.vars`, then `npm run preview` (uses a local, simulated R2).

## Tests

```bash
npm test     # clustering, rank diffs, sponsors.json validation, full pipeline against a temp JSON store
```

## Notes

- Reuters and AP no longer offer public RSS, so they are not in the starter list; add licensed feeds to `lib/feeds.ts` if you get them.
- Feed URLs change over time. The ingest response lists `feedErrors`; prune or fix dead feeds from there.
