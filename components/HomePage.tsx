import { EditionView } from "@/components/EditionView";
import { SiteFooter } from "@/components/SiteFooter";
import { site } from "@/lib/config";
import { getEdition, getLiveEdition, listEditionKeys } from "@/lib/editions";
import { formatFullDate, formatOptionLabel, formatTimeLabel, parseHourKey } from "@/lib/hour";
import type { Locale } from "@/lib/i18n";
import { getAllActiveSponsors } from "@/lib/sponsors";
import { CATEGORIES, DEFAULT_CATEGORY, isCategory, localizeStory, type Category, type Edition } from "@/lib/types";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const hourOf = (key: string) => parseHourKey(key)!;

/** Shared server render for "/", "/es" and "/zh". */
export async function HomePage({ locale, searchParams }: { locale: Locale; searchParams: SearchParams }) {
  const params = await searchParams;
  const tParam = first(params.t);
  const cParam = first(params.c);
  const category: Category = isCategory(cParam) ? cParam : DEFAULT_CATEGORY;
  const requested = parseHourKey(tParam) ? tParam! : null;

  const [raw, keys] = await Promise.all([requested ? getEdition(requested) : getLiveEdition(), listEditionKeys()]);

  // Swap in the reader's language (English where a translation is missing).
  const edition: Edition | null = raw
    ? { ...raw, stories: Object.fromEntries(CATEGORIES.map((c) => [c, (raw.stories[c] ?? []).map((s) => localizeStory(s, locale))])) as Edition["stories"] }
    : null;

  // A shared link to an hour outside the dropdown window still gets an option.
  const optionKeys = edition && !keys.includes(edition.key) ? [...keys, edition.key] : keys;
  const options = optionKeys.map((k) => ({ key: k, label: formatOptionLabel(hourOf(k), locale) }));
  const latest = keys[0] ? { key: keys[0], timeLabel: formatTimeLabel(hourOf(keys[0]), locale) } : null;

  return (
    <>
      <EditionView
        locale={locale}
        edition={edition}
        requestedKey={tParam ?? null}
        initialCategory={category}
        options={options}
        latest={latest}
        editionLabels={
          edition
            ? { time: formatTimeLabel(new Date(edition.snapshotHour), locale), full: formatFullDate(new Date(edition.snapshotHour), locale) }
            : null
        }
        sponsors={getAllActiveSponsors(locale)}
        inquiryEmail={site.sponsorEmail}
        showSponsors={site.showSponsors}
      />
      <SiteFooter locale={locale} />
    </>
  );
}
