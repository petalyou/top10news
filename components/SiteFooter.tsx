import Link from "next/link";
import { site } from "@/lib/config";
import { getDictionary, type Locale } from "@/lib/i18n";

export function SiteFooter({ locale = "en" }: { locale?: Locale }) {
  const t = getDictionary(locale);
  const en = t.footer.englishOnly ? ` ${t.footer.englishOnly}` : "";
  const link = "hover:text-stone-900 dark:hover:text-stone-200 underline-offset-2 hover:underline";
  return (
    <footer className="max-w-3xl mx-auto px-5 sm:px-6 pb-12 text-xs text-stone-500 dark:text-stone-400">
      <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p>
          © {new Date().getFullYear()} {site.legalEntity}. {t.footer.rights} {t.aiNote}
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legal">
          <Link href="/terms" className={link}>{t.footer.terms}{en}</Link>
          <Link href="/privacy" className={link}>{t.footer.privacy}{en}</Link>
          <Link href="/publishers" className={link}>{t.footer.publishers}{en}</Link>
          <Link href="/sponsor" className={link}>{t.footer.advertise}{en}</Link>
        </nav>
      </div>
    </footer>
  );
}
