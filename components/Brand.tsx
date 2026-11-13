/**
 * Brand badge: an upright ivory "10" on a forest-green disc, inside a thin sage ring
 * whose gap and dot sweep slowly clockwise like an hour timer. Only the ring moves.
 */

export function BrandBadge({ className = "" }: { className?: string }) {
  // Pass the size via className, e.g. "w-14 h-14".
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 select-none drop-shadow-[0_8px_14px_rgba(47,82,57,0.35)] ${className}`}>
      <circle cx="50" cy="50" r="50" fill="#2f5239" />
      <g className="logo-sweep">
        {/* Ring with a gap at 12 o'clock; the dot leads the sweep. Circumference ≈ 270.2. */}
        <circle
          cx="50"
          cy="50"
          r="43"
          fill="none"
          stroke="#8fab8a"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray="246 24.2"
          transform="rotate(-82 50 50)"
        />
        <circle cx="50" cy="7" r="4.2" fill="#b2c5ab" />
      </g>
      <text x="50" y="51.5" textAnchor="middle" dominantBaseline="central" fontSize="40" fontWeight="800" letterSpacing="-2" fill="#f8f6ef" className="font-sans">
        10
      </text>
    </svg>
  );
}
