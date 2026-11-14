import Link from "next/link";
import { SiteFooter } from "./SiteFooter";
import { BrandBadge } from "./Brand";
import { site } from "@/lib/config";

export function LegalPage({ title, updated, children }: { title: string; updated?: string | false; children: React.ReactNode }) {
  return (
    <>
      <header>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <BrandBadge className="w-8 h-8 sm:w-9 sm:h-9" />
            <span className="whitespace-nowrap font-display text-[15px] sm:text-lg font-extrabold uppercase tracking-[0.01em]">Top 10 News <span className="text-amber-400 font-bold">/</span> Hourly</span>
          </Link>
          <Link href="/" className="soft-pill shrink-0 px-3 sm:px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap">Latest<span className="hidden min-[400px]:inline"> edition</span> →</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8"><div className="soft-card px-6 py-8 sm:px-10 sm:py-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.01em]">{title}</h1>
        {updated !== false && <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Effective Date: {updated ?? site.legalEffectiveDate}</p>}
        <div className="prose-legal mt-6 text-stone-700 dark:text-stone-300">{children}</div></div>
      </main>
      <SiteFooter />
    </>
  );
}
