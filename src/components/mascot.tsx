import { cn } from "@/lib/cn";

/**
 * "Shamma" — a small lamp-flame character drawn in SVG with soft
 * gradients so it reads as gently 3-D. Used sparingly: success moments and
 * the "all done" state. Purely decorative (aria-hidden).
 *
 * mood: "happy" (smile, bob) · "proud" (closed happy eyes, sparkle) · "calm".
 */
export function Mascot({ className, mood = "happy" }: { className?: string; mood?: "happy" | "proud" | "calm" }) {
  return (
    <svg viewBox="0 0 120 140" className={cn("mascot size-24", mood !== "calm" && "mascot-bob", className)} aria-hidden>
      <defs>
        <radialGradient id="m-flame" cx="45%" cy="38%" r="70%">
          <stop offset="0" stopColor="oklch(0.97 0.06 95)" />
          <stop offset="0.45" stopColor="oklch(0.86 0.15 75)" />
          <stop offset="1" stopColor="oklch(0.68 0.19 45)" />
        </radialGradient>
        <radialGradient id="m-core" cx="50%" cy="60%" r="60%">
          <stop offset="0" stopColor="oklch(0.99 0.03 100)" />
          <stop offset="1" stopColor="oklch(0.93 0.1 90 / 0)" />
        </radialGradient>
        <linearGradient id="m-cup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.17 268)" />
          <stop offset="1" stopColor="oklch(0.42 0.18 275)" />
        </linearGradient>
        <linearGradient id="m-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="oklch(0.55 0.17 268)" />
          <stop offset="0.5" stopColor="oklch(0.78 0.11 268)" />
          <stop offset="1" stopColor="oklch(0.55 0.17 268)" />
        </linearGradient>
        <radialGradient id="m-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="oklch(0.9 0.14 85 / 0.55)" />
          <stop offset="1" stopColor="oklch(0.9 0.14 85 / 0)" />
        </radialGradient>
      </defs>

      {/* glow */}
      <ellipse cx="60" cy="58" rx="50" ry="50" fill="url(#m-glow)" className="mascot-glow" />

      {/* flame body */}
      <g className="mascot-flame">
        <path d="M60 8c10 16 34 30 34 58 0 20-15 34-34 34S26 86 26 66C26 42 46 32 52 16c2 8 5 12 8 14 0-8-1-15 0-22Z" fill="url(#m-flame)" />
        <path d="M60 40c6 9 17 15 17 30 0 10-8 18-17 18s-17-8-17-18c0-13 12-19 17-30Z" fill="url(#m-core)" />
        {/* face */}
        {mood === "proud" ? (
          <>
            <path d="M48 66q4-5 8 0" stroke="oklch(0.3 0.06 40)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M64 66q4-5 8 0" stroke="oklch(0.3 0.06 40)" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <g className="mascot-eyes">
            <ellipse cx="52" cy="66" rx="3.6" ry="4.6" fill="oklch(0.28 0.05 40)" />
            <ellipse cx="68" cy="66" rx="3.6" ry="4.6" fill="oklch(0.28 0.05 40)" />
            <circle cx="53.3" cy="64.4" r="1.3" fill="white" />
            <circle cx="69.3" cy="64.4" r="1.3" fill="white" />
          </g>
        )}
        <path d={mood === "calm" ? "M55 77q5 2 10 0" : "M53 75q7 7 14 0"} stroke="oklch(0.3 0.06 40)" strokeWidth="2.8" fill="none" strokeLinecap="round" />
        <ellipse cx="45" cy="74" rx="4" ry="2.4" fill="oklch(0.75 0.16 30 / 0.45)" />
        <ellipse cx="75" cy="74" rx="4" ry="2.4" fill="oklch(0.75 0.16 30 / 0.45)" />
      </g>

      {/* diya / lamp cup */}
      <path d="M22 100h76c0 16-17 30-38 30S22 116 22 100Z" fill="url(#m-cup)" />
      <ellipse cx="60" cy="100" rx="38" ry="6" fill="url(#m-rim)" />
      <path d="M36 112q24 10 48 0" stroke="oklch(1 0 0 / 0.22)" strokeWidth="2.4" fill="none" strokeLinecap="round" />

      {mood === "proud" && (
        <g fill="oklch(0.85 0.15 85)" className="mascot-sparkle">
          <path d="M100 26l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" />
          <path d="M16 40l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8Z" />
        </g>
      )}
    </svg>
  );
}
