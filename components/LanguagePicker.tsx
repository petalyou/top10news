"use client";

import { useEffect, useState } from "react";
import { getDictionary, LOCALE_LABEL, LOCALE_NUDGE, LOCALE_TAG, LOCALES, preferredLocale, type Locale } from "@/lib/i18n";
import { ChevronDownIcon, CloseIcon, GlobeIcon } from "./icons";

/** Remembered once the visitor answers the first-visit tooltip (or picks a language). */
const NUDGE_KEY = "top10-lang-nudge-done";

function nudgeDone(): boolean {
  try {
    return localStorage.getItem(NUDGE_KEY) === "1";
  } catch {
    return true; // storage blocked: don't nag on every visit
  }
}
function markNudgeDone() {
  try {
    localStorage.setItem(NUDGE_KEY, "1");
  } catch {}
}

/**
 * Language menu: brand-tinted pill with the full language name and a native select on top
 * (works well on phones). On a first visit whose browser language we support but isn't shown,
 * a small tooltip offers it in that language, once.
 */
export function LanguagePicker({ locale, onSelect }: { locale: Locale; onSelect: (l: Locale) => void }) {
  const [offer, setOffer] = useState<Locale | null>(null);

  useEffect(() => {
    if (nudgeDone()) return;
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    const want = preferredLocale(langs);
    if (want && want !== locale) setOffer(want);
  }, [locale]);

  // While the tooltip shows, lift the header above the sticky tab bar it overlaps, and put the
  // tooltip away (without remembering) once the reader scrolls on.
  useEffect(() => {
    if (!offer) return;
    const root = document.documentElement;
    root.dataset.langNudge = "1";
    const onScroll = () => window.scrollY > 40 && setOffer(null);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      delete root.dataset.langNudge;
      window.removeEventListener("scroll", onScroll);
    };
  }, [offer]);

  const choose = (l: Locale) => {
    markNudgeDone();
    setOffer(null);
    if (l !== locale) onSelect(l);
  };
  const dismiss = () => {
    markNudgeDone();
    setOffer(null);
  };

  return (
    <div className="relative ml-auto flex items-center">
      <label htmlFor="language-select" className="sr-only">
        Language
      </label>
      <span className="relative rounded-full focus-within:ring-2 focus-within:ring-amber-500 group">
        <span aria-hidden="true" className="lang-pill flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-full text-xs font-semibold transition-colors">
          <GlobeIcon className="w-3.5 h-3.5 shrink-0" />
          <span lang={LOCALE_TAG[locale]}>{LOCALE_LABEL[locale]}</span>
          <ChevronDownIcon className="w-3 h-3 shrink-0" />
        </span>
        <select
          id="language-select"
          value={locale}
          onChange={(e) => choose(e.target.value as Locale)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l} lang={LOCALE_TAG[l]}>
              {LOCALE_LABEL[l]}
            </option>
          ))}
        </select>
      </span>

      {offer && (
        <div
          role="dialog"
          aria-label={LOCALE_NUDGE[offer]}
          lang={LOCALE_TAG[offer]}
          className="lang-nudge absolute right-0 top-full mt-2.5 z-50 flex items-center gap-1 rounded-full pill-active pl-3.5 pr-1 py-1 text-[13px] font-semibold whitespace-nowrap"
        >
          {/* little arrow pointing up at the picker */}
          <span aria-hidden="true" className="absolute -top-1 right-6 w-2.5 h-2.5 rotate-45 bg-inherit rounded-[2px]" style={{ background: "inherit" }} />
          <button type="button" onClick={() => choose(offer)} className="relative hover:underline underline-offset-2">
            {LOCALE_NUDGE[offer]}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={getDictionary(offer).close}
            title={getDictionary(offer).close}
            className="relative w-7 h-7 rounded-full flex items-center justify-center opacity-80 hover:opacity-100 hover:bg-white/15"
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
