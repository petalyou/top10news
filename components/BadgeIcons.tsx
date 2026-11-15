/**
 * Tiny animated badge icons: a flickering flame for HOT and a swaying leaf for NEW.
 * Shapes take the badge's text colour; the motion lives in globals.css (.badge-flame / .badge-leaf)
 * and stops for readers who prefer reduced motion.
 */

export function FlameIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`badge-flame overflow-visible ${className}`}>
      <path
        className="flame-outer"
        fill="currentColor"
        d="M12 1.5c.6 3.2 2.6 5 4.4 7.2 1.7 2 2.9 4.1 2.9 6.8A7.3 7.3 0 0 1 12 22.8a7.3 7.3 0 0 1-7.3-7.3c0-2.4 1-4.4 2.5-6 .3 1.7 1.1 2.8 2.3 3.4-.4-4 .7-8 2.5-11.4Z"
      />
      <path
        className="flame-inner"
        d="M12 11.2c1.9 2 3.4 3.6 3.4 5.9a3.4 3.4 0 0 1-6.8 0c0-1.5.7-2.6 1.6-3.5.2.8.6 1.3 1.1 1.6-.3-1.4 0-2.7.7-4Z"
      />
    </svg>
  );
}

export function LeafIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`badge-leaf overflow-visible ${className}`}>
      <g className="leaf-sway">
        <path fill="currentColor" d="M4.5 20.5C3.6 12.4 8.6 4.6 20.5 3.5c.9 10.4-5.6 17.3-13.8 16.1-.7-.1-1.4-.3-2.2.9Z" />
        <path className="leaf-rib" fill="none" strokeWidth="1.4" strokeLinecap="round" d="M4.6 20.4C8 15 11.5 11 17 7" />
      </g>
    </svg>
  );
}
