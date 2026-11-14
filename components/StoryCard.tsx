"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { Story } from "@/lib/types";
import { BookmarkIcon, ExternalIcon, ShareIcon } from "./icons";
import { useReveal } from "./useReveal";

/** Stored as "+2" / "-1" / "=" / "NEW"; shown as quiet text: "New" / "↑2" / "↓1" / nothing. */
function RankChange({ change }: { change: string }) {
  if (change === "NEW") {
    return (
      <span title="New in the Top 10 this hour" className="label-caps !text-[8.5px] !tracking-[0.18em] text-amber-500 dark:text-amber-300">
        New
      </span>
    );
  }
  if (change.startsWith("+") || change.startsWith("-")) {
    const up = change.startsWith("+");
    return (
      <span
        title={`${up ? "Up" : "Down"} ${change.slice(1)} since last hour`}
        className="text-[10px] font-semibold tabular-nums text-stone-400 dark:text-stone-500"
      >
        {up ? "↑" : "↓"}
        {change.slice(1)}
      </span>
    );
  }
  return null; // unchanged: say nothing
}

interface Props {
  story: Story;
  t: Dictionary;
  isRead: boolean;
  isBookmarked: boolean;
  compact: boolean;
  onRead: () => void;
  onToggleBookmark: () => void;
  onShare: () => void;
}

export function StoryCard({ story, t, isRead, isBookmarked, compact, onRead, onToggleBookmark, onShare }: Props) {
  const n = story.sources.length;
  // In compact view a click opens just this card; in expanded view everything is open.
  const [open, setOpen] = useState(false);
  const showBody = !compact || open;
  const revealRef = useReveal<HTMLElement>();
  const iconBtn =
    "w-8 h-8 rounded-full flex items-center justify-center text-stone-300 hover:text-stone-800 hover:bg-stone-100 dark:text-stone-600 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition";

  return (
    <article
      ref={revealRef}
      data-reveal="wait"
      id={`rank-${story.rank}`}
      onClick={() => {
        onRead();
        if (compact) setOpen((o) => !o);
      }}
      aria-expanded={compact ? open : undefined}
      className={`story-card soft-card group scroll-mt-24 cursor-pointer ${compact && !open ? "px-5 py-4 sm:px-7 sm:py-5" : "px-5 py-5 sm:px-7 sm:py-6"}`}
    >
      <div className="flex items-start gap-4 sm:gap-5">
        {/* Rank & movement */}
        <div className="flex flex-col items-start shrink-0 w-8 pt-[3px]">
          <span
            className={`text-[15px] sm:text-base font-extrabold tabular-nums leading-none ${
              story.rank <= 3 ? "text-amber-600 dark:text-amber-300" : "text-stone-300 dark:text-stone-600"
            }`}
          >
            {String(story.rank).padStart(2, "0")}
          </span>
          <span className="mt-1.5 leading-none">
            <RankChange change={story.rankChange} />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h2
              className={`text-[16.5px] sm:text-[18.5px] font-semibold leading-[1.35] tracking-[-0.005em] transition-colors ${
                isRead ? "text-stone-700 dark:text-stone-300" : "text-stone-950 dark:text-stone-50"
              } group-hover:text-amber-600 dark:group-hover:text-amber-300`}
            >
              {story.headline}
            </h2>
            <div className="flex items-center -mr-2 -mt-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark();
                }}
                className={iconBtn}
                title={isBookmarked ? t.removeBookmark : t.bookmark}
                aria-pressed={isBookmarked}
                aria-label={isBookmarked ? t.removeBookmark : t.bookmark}
              >
                <BookmarkIcon className={`w-4 h-4 ${isBookmarked ? "fill-amber-600 text-amber-600 dark:fill-amber-300 dark:text-amber-300" : ""}`} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare();
                }}
                className={iconBtn}
                title={t.copyLink}
                aria-label={t.copyLink}
              >
                <ShareIcon />
              </button>
            </div>
          </div>

          {/* Compact view: a quiet source line so readers can judge credibility and click straight out. */}
          {!showBody && n > 0 && (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400 flex flex-wrap items-center gap-x-2">
              {story.sources.slice(0, 2).map((src, idx) => (
                <span key={`${src.outlet}-${idx}`} className="inline-flex items-center gap-2">
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={src.title}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRead();
                    }}
                    className="hover:text-stone-800 dark:hover:text-stone-200 transition"
                  >
                    {src.outlet}
                  </a>
                </span>
              ))}
              {n > 2 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span title={story.sources.slice(2).map((s) => s.outlet).join(", ")}>+{n - 2}</span>
                </>
              )}
            </p>
          )}

          <div className="unfold" data-open={showBody} inert={!showBody} aria-hidden={!showBody}>
          <div>
          <div className="pt-3 space-y-4">
            <p className="text-[15.5px] sm:text-[16.5px] text-stone-800 dark:text-stone-200 leading-[1.65]">{story.summary}</p>

            <div>
              <p className="label-caps !text-[10px] text-amber-600 dark:text-amber-300">{t.whyItMatters}</p>
              <p className="mt-1.5 text-[15px] sm:text-[15.5px] font-medium text-stone-900 dark:text-stone-100 leading-[1.6]">{story.whyItMatters}</p>
            </div>

            {/* Source attribution: direct links to the original publishers */}
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <span className="label-caps !text-[10px] text-stone-500 dark:text-stone-400 mr-1">{t.sources(n)}</span>
              {story.sources.map((src, idx) => (
                <a
                  key={`${src.outlet}-${idx}`}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={src.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRead();
                  }}
                  className="soft-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-stone-800 dark:text-stone-100 hover:text-amber-600 dark:hover:text-amber-300 transition"
                >
                  {src.outlet}
                  <ExternalIcon className="w-3 h-3 opacity-40" />
                </a>
              ))}
            </div>
          </div>
          </div>
          </div>
        </div>
      </div>
    </article>
  );
}
