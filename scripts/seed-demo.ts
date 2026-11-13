/**
 * Development only: writes 3 placeholder editions to .data/ built from
 * test fixtures (no RSS or Claude calls), so the UI can be previewed locally.
 * Usage: npm run db:seed-demo
 */
import { addHours, truncateToHour } from "../lib/hour";
import { runHourlyIngest } from "../lib/ingest/pipeline";
import { storageMode } from "../lib/storage";
import { articlesFor, BASE_EVENTS, T1, type FixtureEvent } from "../tests/fixtures";

// Extra single-outlet stories so every demo category fills all 10 slots.
const filler = (category: FixtureEvent["category"], outlet: string, titles: string[], start: number): FixtureEvent[] =>
  titles.map((t, i) => ({ category, titles: [t], outlets: [{ outlet, tier: 3 }], minutesAgo: start + i * 7 }));
const EXTRA: FixtureEvent[] = [
  ...filler("tech", "Ars Technica", ["Apple delays smart home hub to spring", "Microsoft patches zero-day in Exchange Server", "Samsung unveils 2nm mobile chip roadmap", "OpenSSL ships fix for certificate parsing flaw", "Meta tests paid tier for Threads creators", "Intel foundry lands second hyperscaler customer"], 30),
  ...filler("finance", "MarketWatch", ["Oil slips as OPEC+ signals output hike", "Retail sales beat forecasts in October", "Gold steadies near record above $3,900", "Tesla shares slide on delivery guidance cut", "Japan yen weakens past 160 per dollar", "Home builder sentiment falls to two-year low", "Copper rallies on Chile mine strike"], 30),
  ...filler("politics", "The Hill", ["Senate confirms new Commerce Secretary", "Governors push back on federal rail plan", "House panel subpoenas social media executives", "Supreme Court hears tariff authority case", "Texas redistricting map heads to appeals court", "Bipartisan farm bill clears key committee", "White House names new climate envoy", "State election officials certify midterm results"], 35),
  ...filler("world", "Al Jazeera", ["Japan and South Korea agree new defense hotline", "EU leaders meet on Ukraine reconstruction fund", "Brazil hosts Amazon summit with eight nations", "India and China resume border patrol talks", "Kenya deploys more police to Haiti mission", "Protests grow in Serbia over rail station collapse", "Australia passes social media age limit law", "Mexico and US sign water-sharing deal", "UN warns of famine risk in Sudan"], 30),
];
// Breaking stories that appear only in the latest hour, so the demo shows NEW badges.
const BREAKING: FixtureEvent[] = [
  { category: "tech", titles: ["Amazon unveils custom AI chip to rival Nvidia"], outlets: T1, minutesAgo: 8 },
  { category: "finance", titles: ["Fed signals pause on rate cuts after hot jobs report"], outlets: T1, minutesAgo: 6 },
  { category: "politics", titles: ["Speaker announces surprise vote on stopgap spending bill"], outlets: T1.slice(0, 3), minutesAgo: 9 },
  { category: "world", titles: ["Ceasefire talks resume in Cairo as aid convoys enter Gaza"], outlets: T1, minutesAgo: 7 },
];

async function main() {
  if (process.env.NODE_ENV === "production" || (await storageMode()) === "r2") {
    throw new Error("Refusing to write demo data to R2/production. Run it locally (npm run seed-demo) to seed .data.");
  }
  const current = truncateToHour(new Date());
  for (const offset of [-2, -1, 0]) {
    const hour = addHours(current, offset);
    const events = offset === 0 ? [...BASE_EVENTS, ...EXTRA, ...BREAKING] : [...BASE_EVENTS, ...EXTRA];
    const r = await runHourlyIngest({
      hour,
      now: addHours(hour, -5 / 60),
      deps: {
        fetch: async (now = new Date()) => ({ articles: articlesFor(events, now), feedErrors: [] }),
        dedupe: async () => [],
        synthesize: async (_c, clusters) =>
          clusters.map((c) => ({
            headline: `[Demo] ${c.articles[0].title}`,
            summary: `Placeholder summary for local preview, covered by ${c.articles.length} source article(s). Real editions are written by Claude from live feeds.`,
            whyItMatters: "Demo data: run the hourly ingest with real credentials to replace it.",
            i18n: {
              es: {
                headline: `[Demo ES] ${c.articles[0].title}`,
                summary: `Resumen de ejemplo para la vista previa local, con ${c.articles.length} artículo(s) de origen. Las ediciones reales las redacta Claude a partir de fuentes en vivo.`,
                whyItMatters: "Datos de demostración: ejecuta la ingesta horaria con credenciales reales para reemplazarlos.",
              },
              zh: {
                headline: `[演示] ${c.articles[0].title}`,
                summary: `本地预览用的占位摘要，共 ${c.articles.length} 篇来源文章。正式版本由 Claude 根据实时新闻源撰写。`,
                whyItMatters: "演示数据：配置真实凭据并运行每小时任务后即会替换。",
              },
            },
          })),
      },
    });
    console.log(r.hour, r.status);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
