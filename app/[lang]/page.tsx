import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePage, type SearchParams } from "@/components/HomePage";
import { isLocale, LOCALE_ALTERNATES, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const META: Record<Exclude<Locale, "en">, { title: string; description: string }> = {
  es: { title: "Top 10 News Hourly — Noticias finitas y de alto valor", description: "Las 10 noticias más relevantes de Tecnología e IA, Finanzas y Política, cada hora. Sin scroll infinito." },
  zh: { title: "Top 10 News Hourly — 有限、高信号的新闻", description: "每小时锁定科技与 AI、财经与市场、政治领域最受关注的 10 条新闻。告别无限滚动。" },
  ja: { title: "Top 10 News Hourly — 毎時のトップ10ニュース", description: "テック・AI、金融・マーケット、政治、国際、健康の注目ニュース10本を毎時お届け。無限スクロールなし。" },
  de: { title: "Top 10 News Hourly — Die wichtigsten Nachrichten jeder Stunde", description: "Jede Stunde die 10 wichtigsten Meldungen aus Tech & KI, Finanzen, Politik, Welt und Gesundheit. Kein endloses Scrollen." },
  fr: { title: "Top 10 News Hourly — L’essentiel de l’actualité chaque heure", description: "Chaque heure, les 10 actualités les plus suivies en Tech & IA, Finance, Politique, Monde et Santé. Sans défilement infini." },
  ko: { title: "Top 10 News Hourly — 매시간 톱10 뉴스", description: "테크·AI, 금융, 정치, 국제, 건강 분야에서 가장 주목받는 뉴스 10개를 매시간 전합니다. 끝없는 스크롤은 없습니다." },
  pt: { title: "Top 10 News Hourly — As notícias que importam, a cada hora", description: "A cada hora, as 10 notícias mais relevantes de Tecnologia e IA, Finanças, Política, Mundo e Saúde. Sem rolagem infinita." },
};

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang) || lang === "en") return {};
  return {
    ...META[lang],
    alternates: { canonical: `/${lang}`, languages: LOCALE_ALTERNATES },
  };
}

export default async function LocalizedHome({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { lang } = await params;
  // "/en" isn't a route: English lives at "/".
  if (!isLocale(lang) || lang === "en") notFound();
  return <HomePage locale={lang} searchParams={searchParams} />;
}
