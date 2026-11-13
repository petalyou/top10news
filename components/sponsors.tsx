import type { Sponsor } from "@/lib/sponsors";
import type { Dictionary } from "@/lib/i18n";
import type { Category } from "@/lib/types";

function SponsorLink({ sponsor, className, children }: { sponsor: Sponsor; className: string; children: React.ReactNode }) {
  return (
    <a href={sponsor.targetUrl} target="_blank" rel="sponsored noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// <CategoryTitleSponsor/>: compact "Presented by" bar directly above story #1
// ---------------------------------------------------------------------------

export function CategoryTitleSponsor({ sponsor, label }: { sponsor: Sponsor | null; label: string }) {
  if (!sponsor) return null;
  return (
    <aside
      aria-label={`Sponsor: ${sponsor.sponsorName}`}
      className="mb-6 rounded-2xl bg-stone-100/90 dark:bg-stone-900/90 border border-stone-200/90 dark:border-stone-800 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <span className="shrink-0 mt-0.5 sm:mt-0 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
          {label}
        </span>
        <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-snug">
          <strong className="font-semibold text-stone-900 dark:text-white">{sponsor.headline}</strong>
          {sponsor.summary && <> — {sponsor.summary}</>}
        </p>
      </div>
      <SponsorLink
        sponsor={sponsor}
        className="shrink-0 self-start sm:self-center text-xs font-semibold text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 px-3 py-1.5 rounded-xl transition"
      >
        {sponsor.ctaLabel}
      </SponsorLink>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// <SponsoredBriefingCard/>: unranked native card between story #3 and #4
// ---------------------------------------------------------------------------

export function SponsoredBriefingCard({
  sponsor,
  category,
  compact,
  inquiryEmail,
  t,
}: {
  sponsor: Sponsor | null;
  category: Category;
  compact: boolean;
  inquiryEmail: string;
  t: Dictionary;
}) {
  if (!sponsor) return <HouseSponsorCard category={category} inquiryEmail={inquiryEmail} t={t} />;

  return (
    <aside
      aria-label={`Sponsored briefing from ${sponsor.sponsorName}`}
      className={`rounded-2xl bg-stone-100/70 dark:bg-stone-900/50 border border-dashed border-amber-300/70 dark:border-amber-800/60 ${compact ? "px-4 py-3.5 sm:px-5" : "p-5 sm:p-6"}`}
    >
      <div className="flex items-start gap-3.5 sm:gap-4">
        {/* Deliberately no rank number: the Top 10 order is purely editorial. */}
        <div className="w-9 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500 text-white dark:text-stone-950">
              {t.sponsored}
            </span>
            <h2 className="font-serif text-base sm:text-lg font-bold text-stone-900 dark:text-stone-50 leading-snug">{sponsor.headline}</h2>
          </div>
          <p className="mt-1 text-[11px] font-mono text-stone-500 dark:text-stone-400">{t.paidPlacement(sponsor.sponsorName)}</p>

          <div className={`${compact ? "hidden" : "block"} mt-2.5 space-y-3`}>
            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">{sponsor.summary}</p>
            {sponsor.whyItMatters && (
              <div className="rounded-xl bg-white/70 dark:bg-stone-900/60 border-l-3 border-amber-500 px-3.5 py-2.5">
                <p className="text-xs sm:text-sm text-stone-800 dark:text-stone-200 leading-snug">
                  <span className="font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[11px] font-mono mr-1.5">{t.whyItMatters}</span>
                  {sponsor.whyItMatters}
                </p>
              </div>
            )}
          </div>
          <SponsorLink
            sponsor={sponsor}
            className={`${compact ? "mt-1.5" : "mt-3"} inline-flex text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline`}
          >
            {sponsor.ctaLabel}
          </SponsorLink>
        </div>
      </div>
    </aside>
  );
}

export function sponsorMailto(email: string, categoryLabel: string) {
  const subject = encodeURIComponent(`Sponsor inquiry: ${categoryLabel} Edition`);
  const body = encodeURIComponent(`Name:\nCompany:\nWork email:\nPreferred category: ${categoryLabel}\n\nAnything else:\n`);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

function HouseSponsorCard({ category, inquiryEmail, t }: { category: Category; inquiryEmail: string; t: Dictionary }) {
  return (
    <aside className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-stone-500 dark:text-stone-400">
        <span className="font-mono uppercase tracking-wider text-[10px] mr-2 text-stone-400 dark:text-stone-500">{t.advertise}</span>
        {t.reachReaders}
      </p>
      <a
        href={sponsorMailto(inquiryEmail, t.categoryTab[category])}
        className="text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white underline-offset-2 hover:underline"
      >
        {t.sponsorEdition(t.categoryTab[category])}
      </a>
    </aside>
  );
}

