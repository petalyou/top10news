"use client";

import Link from "next/link";
import { BrandBadge } from "./Brand";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatEditionWindow, formatFullDate, formatOptionLabel, formatTimeLabel, nextEditionTime, parseHourKey } from "@/lib/hour";
import { getDictionary, LOCALE_LABEL, LOCALE_NAME, LOCALE_TAG, LOCALES, localePath, type Locale } from "@/lib/i18n";
import type { ActiveSponsors } from "@/lib/sponsors";
import { CATEGORIES, DEFAULT_CATEGORY, type Category, type Edition } from "@/lib/types";
import { BookmarkIcon, CheckIcon, ChevronDownIcon, ClockIcon, CloseIcon, MoonIcon, SunIcon } from "./icons";
import { FlipText } from "./FlipText";
import { CategoryTitleSponsor, SponsoredBriefingCard } from "./sponsors";
import { StoryCard } from "./StoryCard";
import { holdReveals, useReveal } from "./useReveal";

// ---------------------------------------------------------------------------
// Saved bookmarks (localStorage, same key as the prototype)
// ---------------------------------------------------------------------------

interface Bookmark {
  id: string;
  headline: string;
  whyItMatters: string;
  category: string;
  snapshotLabel: string;
  /** Permanent link back to the story in its edition. */
  href?: string;
}

const BOOKMARKS_KEY = "top10_bookmarks";

function loadBookmarks(): Bookmark[] {
  try {
    const raw = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveBookmarks(list: Bookmark[]) {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode) */
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seconds until the next edition (hourly, 5 AM to midnight Eastern). */
function secondsToNextHour(): number {
  const now = new Date();
  return Math.max(0, Math.ceil((nextEditionTime(now).getTime() - now.getTime()) / 1000));
}

function editionHref(locale: Locale, key: string | null, category: Category, hash = "") {
  const qs = new URLSearchParams();
  if (key) qs.set("t", key);
  if (category !== DEFAULT_CATEGORY || key) qs.set("c", category);
  const s = qs.toString();
  return `${localePath(locale)}${s ? `?${s}` : ""}${hash}`;
}

interface Props {
  locale: Locale;
  edition: Edition | null;
  requestedKey: string | null;
  initialCategory: Category;
  options: { key: string; label: string }[];
  latest: { key: string; timeLabel: string } | null;
  editionLabels: { time: string; full: string } | null;
  sponsors: Record<Category, ActiveSponsors>;
  /** Global switch for every sponsor slot (SHOW_SPONSORS). */
  showSponsors: boolean;
  inquiryEmail: string;
}

export function EditionView({ locale, edition, requestedKey, initialCategory, options: serverOptions, latest: serverLatest, editionLabels: serverEditionLabels, sponsors: sponsorsByCategory, inquiryEmail, showSponsors }: Props) {
  const t = getDictionary(locale);
  const router = useRouter();
  const [category, setCategory] = useState<Category>(initialCategory);
  const [compact, setCompact] = useState(true); // grab-and-go default: headlines first
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const toastSeq = useRef(0);
  const finishRef = useReveal<HTMLElement>();

  // Times are server-rendered in a fallback zone, then re-labelled in the viewer's own zone once mounted.
  const [localZone, setLocalZone] = useState(false);
  useEffect(() => setLocalZone(true), []);
  const { options, latest, editionLabels } = useMemo(() => {
    if (!localZone) return { options: serverOptions, latest: serverLatest, editionLabels: serverEditionLabels };
    const at = (k: string) => parseHourKey(k);
    return {
      options: serverOptions.map((o) => {
        const d = at(o.key);
        return d ? { ...o, label: formatOptionLabel(d, locale, null) } : o;
      }),
      latest: serverLatest && at(serverLatest.key) ? { ...serverLatest, timeLabel: formatTimeLabel(at(serverLatest.key)!, locale, null) } : serverLatest,
      editionLabels:
        edition && serverEditionLabels
          ? { time: formatTimeLabel(new Date(edition.snapshotHour), locale, null), full: formatFullDate(new Date(edition.snapshotHour), locale, null) }
          : serverEditionLabels,
    };
  }, [localZone, serverOptions, serverLatest, serverEditionLabels, edition, locale]);

  const sponsors = sponsorsByCategory[category];
  const isLatest = Boolean(edition && latest && edition.key === latest.key);
  const viewingLive = !requestedKey; // following the live edition rather than a pinned hour
  const stories = useMemo(() => edition?.stories[category] ?? [], [edition, category]);

  // Edition arrival effects, on every page load and whenever a new edition comes in: the time
  // flips to the new hour, a green line sweeps under it, the dot pulses, a "New edition" tag
  // shows for a few seconds, then the stories glide in one by one. Waits for the local-time
  // relabel so it plays once, on the reader's own time.
  const [arrival, setArrival] = useState(0);
  const [showNewTag, setShowNewTag] = useState(false);
  const editionKey = edition?.key;
  useEffect(() => {
    if (!localZone || !editionKey) return;
    setArrival((n) => n + 1);
    if (document.documentElement.classList.contains("js-motion")) holdReveals(800);
    if (!isLatest) return;
    setShowNewTag(true);
    const id = window.setTimeout(() => setShowNewTag(false), 4600);
    return () => window.clearTimeout(id);
  }, [localZone, editionKey, isLatest]);
  const newTagClass =
    "new-edition-tag rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] bg-amber-400/15 text-amber-600 dark:text-amber-300 whitespace-nowrap";
  const editionLabel = edition
    ? `${options.find((o) => o.key === edition.key)?.label ?? editionLabels?.time ?? ""}${isLatest ? t.latestSuffix : ""}`
    : t.selectEdition;

  const showToast = useCallback((message: string) => {
    const id = ++toastSeq.current;
    setToasts((x) => [...x, { id, message }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3100);
  }, []);

  // <html lang> follows the page language (the root layout is shared).
  useEffect(() => {
    document.documentElement.lang = LOCALE_TAG[locale];
  }, [locale]);

  // Keep the active tab visible when the tab strip scrolls (phones).
  const tabRefs = useRef<Partial<Record<Category, HTMLButtonElement | null>>>({});
  useEffect(() => {
    const el = tabRefs.current[category];
    const strip = el?.parentElement?.parentElement;
    if (el && strip && strip.scrollWidth > strip.clientWidth) {
      const offset = el.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
      strip.scrollTo({ left: offset - (strip.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
    }
  }, [category]);

  // Bookmarks hydrate from localStorage after mount.
  useEffect(() => setBookmarks(loadBookmarks()), []);

  // Keep category in sync when navigating between editions via the router.
  useEffect(() => setCategory(initialCategory), [initialCategory]);

  // Live countdown to the next top-of-the-hour edition.
  const topOfHourMsg = t.toasts.topOfHour;
  useEffect(() => {
    setSecondsLeft(secondsToNextHour());
    let prev = secondsToNextHour();
    const timer = setInterval(() => {
      const s = secondsToNextHour();
      if (s > prev) {
        showToast(topOfHourMsg);
        // Pull the new edition if the reader is following the live edition.
        if (viewingLive) setTimeout(() => router.refresh(), 2000 + Math.random() * 8000);
      }
      prev = s;
      setSecondsLeft(s);
    }, 1000);
    return () => clearInterval(timer);
  }, [router, showToast, viewingLive, topOfHourMsg]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const countdown =
    secondsLeft == null
      ? "--:--"
      : `${secondsLeft >= 3600 ? `${Math.floor(secondsLeft / 3600)}:` : ""}${pad(Math.floor((secondsLeft % 3600) / 60))}:${pad(secondsLeft % 60)}`;

  // ------------------------------------------------------------------ actions

  // Swipe between tabs (touch screens). Only a clear, quick sideways swipe counts, so vertical
  // scrolling, taps and sideways scrolling inside the tab strip are left alone.
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  function onSwipeStart(e: React.TouchEvent) {
    const target = e.target as HTMLElement;
    if (e.touches.length !== 1 || target.closest("select, input, textarea, [data-no-swipe]")) {
      swipeStart.current = null;
      return;
    }
    const p = e.touches[0];
    swipeStart.current = { x: p.clientX, y: p.clientY, t: Date.now() };
  }
  function onSwipeEnd(e: React.TouchEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - start.t > 800) return;
    const i = CATEGORIES.indexOf(category);
    const next = dx < 0 ? i + 1 : i - 1; // swipe left = next tab
    if (next < 0 || next >= CATEGORIES.length) return;
    setSwipeDir(dx < 0 ? "left" : "right");
    switchCategory(CATEGORIES[next], false);
  }

  function switchCategory(cat: Category, fromTab = true) {
    if (fromTab) setSwipeDir(null);
    setCategory(cat);
    // Shallow URL update: all three categories are already loaded.
    window.history.replaceState(null, "", editionHref(locale, requestedKey, cat));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSnapshotChange(key: string) {
    const label = options.find((o) => o.key === key)?.label ?? key;
    router.push(editionHref(locale, latest && key === latest.key ? null : key, category));
    showToast(t.toasts.loadedEdition(label));
  }

  function markRead(id: string) {
    setReadIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  function toggleBookmark(storyId: string) {
    const story = stories.find((s) => s.id === storyId);
    if (!story || !edition || !editionLabels) return;
    const existing = bookmarks.some((b) => b.id === storyId);
    const next = existing
      ? bookmarks.filter((b) => b.id !== storyId)
      : [
          {
            id: story.id,
            headline: story.headline,
            whyItMatters: story.whyItMatters,
            category: t.categoryTab[category],
            snapshotLabel: editionLabels.time,
            href: editionHref(locale, edition.key, category, `#rank-${story.rank}`),
          },
          ...bookmarks,
        ];
    setBookmarks(next);
    saveBookmarks(next);
    showToast(existing ? t.toasts.removed : t.toasts.saved);
  }

  function removeBookmark(id: string) {
    const next = bookmarks.filter((b) => b.id !== id);
    setBookmarks(next);
    saveBookmarks(next);
  }

  async function copySnapshotLink(rank: number) {
    if (!edition) return;
    const url = `${window.location.origin}${editionHref(locale, edition.key, category, `#rank-${rank}`)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const tmp = document.createElement("input");
      tmp.value = url;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      tmp.remove();
    }
    showToast(t.toasts.copied(rank));
  }

  function toggleTheme() {
    const html = document.documentElement;
    html.classList.toggle("dark");
    try {
      localStorage.setItem("top10_theme", html.classList.contains("dark") ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  // Escape closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const readCount = stories.filter((s) => readIds.has(s.id)).length;
  const total = stories.length;
  // Native sponsor sits between #3 and #4 (or after the last story on a short list).
  const sponsorAfterIndex = Math.min(2, total - 1);

  // ------------------------------------------------------------------ render

  return (
    <div lang={LOCALE_TAG[locale]}>
      {/* Toasts */}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className="pointer-events-auto px-5 py-3 rounded-full bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 text-xs font-semibold shadow-lg">
            {x.message}
          </div>
        ))}
      </div>

      {/* Saved bookmarks drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-xs" onClick={() => setDrawerOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-title"
            className="bg-paper-50 dark:bg-paper-950 w-full max-w-md h-full shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-7 pb-5 flex items-start justify-between">
              <div>
                <h2 id="saved-title" className="label-caps text-stone-900 dark:text-stone-50">
                  {t.savedTitle}
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5">{t.savedSubtitle}</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label={t.close} className="soft-pill w-9 h-9 rounded-full flex items-center justify-center text-stone-500">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
              {bookmarks.length === 0 ? (
                <div className="text-center py-12 text-stone-400 dark:text-stone-500">
                  <p className="text-sm font-medium">{t.noSaved}</p>
                  <p className="text-xs mt-1">{t.noSavedHint}</p>
                </div>
              ) : (
                bookmarks.map((item) => (
                  <div key={item.id} className="soft-card p-5">
                    <div className="flex items-center justify-between text-[10px] label-caps text-stone-400 mb-2">
                      <span>
                        {item.category} · {item.snapshotLabel}
                      </span>
                      <button type="button" onClick={() => removeBookmark(item.id)} className="text-stone-400 hover:text-stone-900 dark:hover:text-white">
                        {t.remove}
                      </button>
                    </div>
                    {item.href ? (
                      <Link href={item.href} onClick={() => setDrawerOpen(false)} className="block font-semibold text-[15px] text-stone-900 dark:text-stone-50 leading-snug mb-1.5 hover:text-amber-600 dark:hover:text-amber-300">
                        {item.headline}
                      </Link>
                    ) : (
                      <h4 className="font-semibold text-[15px] text-stone-900 dark:text-stone-50 leading-snug mb-1.5">{item.headline}</h4>
                    )}
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{item.whyItMatters}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Masthead */}
      <header className="max-w-3xl mx-auto px-5 sm:px-6 pt-8 sm:pt-14">
        <div className="flex items-start justify-between gap-4">
          <Link href={editionHref(locale, null, category)} className="flex items-center gap-2.5 min-[400px]:gap-3 sm:gap-5 min-w-0" aria-label="Top 10 News Hourly">
            <BrandBadge className="badge-in w-9 h-9 min-[400px]:w-10 min-[400px]:h-10 sm:w-14 sm:h-14" />
            <span className="min-w-0">
              <span style={{ "--d": 120 } as React.CSSProperties} className="rise block whitespace-nowrap font-display font-extrabold uppercase tracking-[0.01em] leading-none text-[13px] min-[350px]:text-[15px] min-[380px]:text-lg min-[400px]:text-xl sm:text-3xl md:text-[2.5rem] text-stone-900 dark:text-stone-50">
                Top 10 News <span className="text-amber-400 font-bold">/</span> Hourly
              </span>
              <span style={{ "--d": 260 } as React.CSSProperties} className="rise block mt-2 sm:mt-3 whitespace-nowrap label-caps !text-[9.5px] sm:!text-[11px] !tracking-[0.16em] min-[400px]:!tracking-[0.22em] sm:!tracking-[0.28em] text-stone-500 dark:text-stone-400">
                {/* Phones have room for the hours only, so the tagline gives way to a short label. */}
                <span className="hidden sm:inline">{t.tagline}<span className="text-stone-400 dark:text-stone-500"> · </span></span>
                <span className="sm:hidden">{t.hoursLabel} </span>
                {/* Publishing hours, in the reader's own zone once mounted. */}
                <span suppressHydrationWarning>{formatEditionWindow(new Date(), locale, localZone ? null : undefined)}</span>
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="soft-pill relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white transition"
              title={t.savedStories}
              aria-label={`${t.savedStories} (${bookmarks.length})`}
            >
              <BookmarkIcon className="w-[18px] h-[18px]" />
              {bookmarks.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="soft-pill w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white transition"
              title={t.toggleTheme}
              aria-label={t.toggleTheme}
            >
              <SunIcon className="w-[18px] h-[18px] hidden dark:block" />
              <MoonIcon className="w-[18px] h-[18px] block dark:hidden" />
            </button>
          </div>
        </div>

        {/* Edition · next drop · language */}
        <div style={{ "--d": 380 } as React.CSSProperties} className="rise mt-7 sm:mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs sm:text-[13px] text-stone-500 dark:text-stone-400">
          {options.length > 0 && (
            <div className="flex items-center gap-2 min-w-0">
              <ClockIcon className="w-4 h-4 shrink-0" />
              <label htmlFor="time-machine-select" className="sr-only">
                {t.timeMachineLabel}
              </label>
              {/* The visible label (so the time can flip); the real select sits invisibly on top. */}
              <span className="relative min-w-0 rounded focus-within:ring-2 focus-within:ring-amber-500 group">
                <span aria-hidden="true" className="flex items-center gap-1 font-semibold text-stone-700 dark:text-stone-200 group-hover:text-stone-900 dark:group-hover:text-white max-w-[14rem] sm:max-w-none overflow-hidden">
                  <FlipText key={arrival} text={editionLabel} play={arrival > 0} />
                  <ChevronDownIcon className="w-3.5 h-3.5 shrink-0" />
                </span>
                {arrival > 0 && <span key={arrival} className="edition-sweep" aria-hidden="true" />}
                <select
                  id="time-machine-select"
                  value={edition?.key ?? ""}
                  onChange={(e) => handleSnapshotChange(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base"
                >
                  {!edition && <option value="">{t.selectEdition}</option>}
                  {options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                      {latest && o.key === latest.key ? t.latestSuffix : ""}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span key={arrival} className={`w-1.5 h-1.5 rounded-full bg-amber-400 ${arrival > 0 ? "dot-pulse" : ""}`} aria-hidden="true" />
            {/* Phones: the "New edition" tag briefly takes the place of "Next drop" so nothing reflows (very narrow phones skip it). */}
            {showNewTag && (
              <span key={`m${arrival}`} className={`${newTagClass} hidden min-[360px]:inline-block sm:hidden`} aria-hidden="true">
                {t.newEdition}
              </span>
            )}
            <span>
              <span className={showNewTag ? "min-[360px]:hidden sm:inline" : ""}>{t.nextDrop} </span>
              <span className="font-semibold text-stone-700 dark:text-stone-200 tabular-nums">{countdown}</span>
            </span>
            {showNewTag && (
              <span key={arrival} role="status" className={`${newTagClass} hidden sm:inline-block`}>
                {t.newEdition}
              </span>
            )}
          </div>

          <nav aria-label="Language" className="ml-auto flex items-center gap-1">
            {LOCALES.map((l) => (
              <Link
                key={l}
                href={editionHref(l, requestedKey, category)}
                hrefLang={LOCALE_TAG[l]}
                lang={LOCALE_TAG[l]}
                title={LOCALE_LABEL[l]}
                aria-current={l === locale ? "true" : undefined}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[0.12em] transition ${
                  l === locale ? "pill-active" : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
                }`}
              >
                {LOCALE_NAME[l]}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Sticky category pills */}
      <div className="sticky top-0 z-40 bg-paper-50/85 dark:bg-paper-950/85 backdrop-blur-md mt-6 sm:mt-8">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <nav aria-label="Categories" style={{ "--d": 480 } as React.CSSProperties} className="rise flex items-center py-3.5 sm:py-4 overflow-x-auto no-scrollbar -mx-1 px-1">
            <div className="flex gap-2.5 sm:gap-3" role="tablist">
              {CATEGORIES.map((cat) => {
                const active = cat === category;
                return (
                  <button
                    key={cat}
                    ref={(el) => {
                      tabRefs.current[cat] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchCategory(cat)}
                    className={`px-5 sm:px-7 py-2.5 sm:py-3 rounded-full text-[15px] sm:text-base font-bold whitespace-nowrap transition ${
                      active ? "pill-active" : "soft-pill text-stone-700 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white"
                    }`}
                  >
                    {t.categoryTab[cat]}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-5 sm:px-6 pt-5 sm:pt-7 pb-8">
        {/* Time Machine banner (past editions only) */}
        {edition && !isLatest && latest && (
          <div style={{ "--d": 540 } as React.CSSProperties} className="rise soft-card mb-6 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm text-stone-700 dark:text-stone-200">
              <span className="label-caps !text-[10px] text-amber-600 dark:text-amber-300">{t.timeMachineBadge}</span>
              <span>
                {t.viewingSnapshot} <strong className="font-semibold">{editionLabels?.time}</strong>.
              </span>
            </div>
            <Link href={editionHref(locale, null, category)} className="text-xs font-bold text-amber-600 dark:text-amber-300 hover:underline">
              {t.jumpToLatest(latest.timeLabel)}
            </Link>
          </div>
        )}

        {!edition ? (
          <div className="soft-card px-6 py-14 text-center">
            {requestedKey ? (
              <>
                <h1 className="text-xl font-bold">{t.missingTitle}</h1>
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
                  {t.missingBody} <span className="font-mono">{requestedKey}</span> (UTC).
                </p>
                {latest && (
                  <Link href={editionHref(locale, null, category)} className="pill-active inline-block mt-6 px-5 py-2.5 rounded-full text-sm font-bold">
                    {t.goLatest}
                  </Link>
                )}
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold">{t.firstEditionTitle}</h1>
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">{t.firstEditionBody}</p>
              </>
            )}
          </div>
        ) : (
          // Phones: swipe the list left/right to move to the next/previous tab.
          <div onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd} onTouchCancel={() => (swipeStart.current = null)}>
            <div style={{ "--d": 560 } as React.CSSProperties} className="rise flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-5">
              <h1 className="label-caps text-stone-800 dark:text-stone-100">{t.categoryTitle[category]}</h1>
              <div className="flex items-center gap-4">
                <span className="text-[11px] font-semibold tracking-[0.12em] text-stone-400 dark:text-stone-500 tabular-nums">{t.read(readCount, total)}</span>
                <div role="group" aria-label="View" className="soft-pill inline-flex p-1 rounded-full text-[13px]">
                  {([true, false] as const).map((mode) => (
                    <button
                      key={String(mode)}
                      type="button"
                      onClick={() => setCompact(mode)}
                      aria-pressed={compact === mode}
                      className={`px-3.5 sm:px-4 py-1.5 rounded-full font-bold whitespace-nowrap transition ${
                        compact === mode ? "pill-active" : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
                      }`}
                    >
                      {mode ? t.compactView : t.expandedView}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {showSponsors && <CategoryTitleSponsor sponsor={sponsors.titleBanner} label={sponsors.titleBanner ? t.presentedBy(sponsors.titleBanner.sponsorName) : ""} />}

            <section key={category} className={`list-in ${swipeDir ? `swipe-in-${swipeDir}` : ""} ${compact ? "space-y-3" : "space-y-4"}`} aria-label={t.categoryTitle[category]}>
              {stories.length === 0 && <p className="text-sm text-stone-500 dark:text-stone-400 py-10 text-center">{t.noStoriesInCategory}</p>}
              {stories.map((story, i) => (
                <Fragment key={story.id}>
                  <StoryCard
                    story={story}
                    t={t}
                    compact={compact}
                    isRead={readIds.has(story.id)}
                    isBookmarked={bookmarks.some((b) => b.id === story.id)}
                    onRead={() => markRead(story.id)}
                    onToggleBookmark={() => toggleBookmark(story.id)}
                    onShare={() => copySnapshotLink(story.rank)}
                  />
                  {showSponsors && i === sponsorAfterIndex && (
                    <SponsoredBriefingCard sponsor={sponsors.nativeBriefing} category={category} compact={compact} inquiryEmail={inquiryEmail} t={t} />
                  )}
                </Fragment>
              ))}
            </section>
          </div>
        )}

        {/* Finish line */}
        <footer ref={finishRef} data-reveal="wait" className="soft-card mt-10 mb-4 text-center py-10 px-5">
          <div className="w-11 h-11 rounded-full pill-active flex items-center justify-center mx-auto mb-4">
            <CheckIcon className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">{t.caughtUpTitle}</h3>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => switchCategory(cat)}
                className={`px-4 py-2 rounded-full text-[13px] font-bold transition ${
                  cat === category ? "pill-active" : "soft-pill text-stone-700 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white"
                }`}
              >
                {t.categoryTab[cat]}
              </button>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}
