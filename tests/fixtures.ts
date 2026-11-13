import type { Article } from "../lib/ingest/fetch";
import type { Category } from "../lib/types";

/** Each event: category + how many outlets cover it + headline variants. */
export interface FixtureEvent {
  category: Category;
  titles: string[];
  outlets: { outlet: string; tier: 1 | 2 | 3 }[];
  minutesAgo: number;
}

let n = 0;
export function articlesFor(events: FixtureEvent[], now: Date): Article[] {
  const out: Article[] = [];
  for (const e of events) {
    e.outlets.forEach((o, i) => {
      out.push({
        outlet: o.outlet,
        tier: o.tier,
        category: e.category,
        title: e.titles[i % e.titles.length],
        url: `https://${o.outlet.toLowerCase().replace(/\W+/g, "")}.example/${e.titles[0].toLowerCase().replace(/\W+/g, "-")}`,
        teaser: `${e.titles[0]}. Additional context ${++n}.`,
        publishedAt: new Date(now.getTime() - (e.minutesAgo + i * 5) * 60_000),
      });
    });
  }
  return out;
}

const O = (outlet: string, tier: 1 | 2 | 3) => ({ outlet, tier });
export const T1 = [O("Bloomberg", 1), O("New York Times", 1), O("BBC News", 1), O("The Guardian", 1)];
export const T2 = [O("TechCrunch", 2), O("The Verge", 2), O("Politico", 2), O("The Hill", 2)];

export const BASE_EVENTS: FixtureEvent[] = [
  { category: "tech", titles: ["Nvidia CEO Jensen Huang resigns; CFO named interim chief", "Jensen Huang steps down as Nvidia CEO", "Nvidia names interim CEO after Jensen Huang resigns"], outlets: [...T1, ...T2.slice(0, 2)], minutesAgo: 20 },
  { category: "tech", titles: ["DeepMind launches AlphaGenome 2 for DNA variant prediction", "Google DeepMind AlphaGenome 2 predicts DNA variants"], outlets: T1.slice(0, 3), minutesAgo: 40 },
  { category: "tech", titles: ["Anthropic rolls out Claude whiteboards and spreadsheets", "Anthropic adds whiteboards, spreadsheets to Claude"], outlets: T2.slice(0, 2), minutesAgo: 30 },
  { category: "tech", titles: ["Attackers weaponize AntiFox pentesting tool against AWS secrets"], outlets: [O("The Register", 3)], minutesAgo: 60 },
  { category: "finance", titles: ["Nvidia stock plunges nearly 10% after CEO exit", "Nvidia shares tumble on Huang resignation"], outlets: T1, minutesAgo: 15 },
  { category: "finance", titles: ["Treasury yields surge as 10-year tops 5.08%", "10-year Treasury yield tops 5.08% in bond selloff"], outlets: T1.slice(0, 2), minutesAgo: 50 },
  { category: "finance", titles: ["Bitcoin falls below $73,000 in risk-off rotation"], outlets: [O("CoinDesk", 3)], minutesAgo: 70 },
  { category: "politics", titles: ["Democrats win Mississippi Senate runoff, reach 55 seats", "Mississippi runoff win gives Democrats 55 Senate seats"], outlets: [...T1, O("Politico", 2)], minutesAgo: 25 },
  { category: "politics", titles: ["Congress faces one-month deadline to avoid government shutdown", "Government shutdown deadline looms for Congress"], outlets: [O("Politico", 2), O("The Hill", 2), O("NPR", 1)], minutesAgo: 45 },
];
