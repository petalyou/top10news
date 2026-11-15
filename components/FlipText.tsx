/**
 * Text whose digits flip into place like an airport departures board. Remount it (change its
 * `key`) to play the flip again; with `play` false it renders as plain text.
 */
export function FlipText({ text, play }: { text: string; play: boolean }) {
  let digit = 0;
  return (
    <span className="whitespace-nowrap">
      {[...text].map((ch, i) =>
        play && /\d/.test(ch) ? (
          <span key={i} className="flip-char" style={{ "--i": digit++ } as React.CSSProperties}>
            {ch}
          </span>
        ) : (
          ch
        ),
      )}
    </span>
  );
}
