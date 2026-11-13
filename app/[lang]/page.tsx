import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePage, type SearchParams } from "@/components/HomePage";
import { isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const META = {
  es: { title: "Top 10 News Hourly — Noticias finitas y de alto valor", description: "Las 10 noticias más relevantes de Tecnología e IA, Finanzas y Política, cada hora. Sin scroll infinito." },
  zh: { title: "Top 10 News Hourly — 有限、高信号的新闻", description: "每小时锁定科技与 AI、财经与市场、政治领域最受关注的 10 条新闻。告别无限滚动。" },
} as const;

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es" && lang !== "zh") return {};
  return {
    ...META[lang],
    alternates: { canonical: `/${lang}`, languages: { en: "/", es: "/es", "zh-Hans": "/zh" } },
  };
}

export default async function LocalizedHome({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { lang } = await params;
  // "/en" isn't a route: English lives at "/".
  if (!isLocale(lang) || lang === "en") notFound();
  return <HomePage locale={lang} searchParams={searchParams} />;
}
