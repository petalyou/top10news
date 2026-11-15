"use client";

import { useEffect, useRef } from "react";

/**
 * Apple-style scroll reveal: elements start soft (faded, lowered, slightly blurred) and glide
 * into place when they enter the viewport. Elements that arrive together are staggered.
 * Only active when <html> has the "js-motion" class (set before paint unless the reader
 * prefers reduced motion), so nothing is ever hidden without JavaScript.
 */

const STAGGER_MS = 70;
const MAX_STAGGER_STEPS = 8;
const DURATION_MS = 800;

let observer: IntersectionObserver | null = null;
/** Reveals wait until this time, so a new edition's stories glide in after its header effects. */
let holdUntil = 0;

/** Delay reveals that start in the next `ms` milliseconds until those `ms` have passed. */
export function holdReveals(ms: number) {
  holdUntil = Date.now() + ms;
}

function getObserver(): IntersectionObserver {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      let step = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        observer!.unobserve(el);
        const delay = Math.max(0, holdUntil - Date.now()) + Math.min(step++, MAX_STAGGER_STEPS) * STAGGER_MS;
        el.style.transitionDelay = `${delay}ms`;
        el.dataset.reveal = "shown";
        // Hand back to the normal (fast) hover transitions once the entrance is over.
        window.setTimeout(() => {
          el.style.transitionDelay = "";
          el.dataset.reveal = "done";
        }, delay + DURATION_MS + 50);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  return observer;
}

export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!document.documentElement.classList.contains("js-motion") || typeof IntersectionObserver === "undefined") {
      el.dataset.reveal = "done";
      return;
    }
    const io = getObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);
  return ref;
}
