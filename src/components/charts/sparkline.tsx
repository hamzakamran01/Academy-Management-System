/**
 * Tiny trend line for a subject's test percentages (0–100 fixed scale).
 * Supplementary only — every value is also listed in text next to it.
 */
export function Sparkline({ points, className }: { points: (number | null)[]; className?: string }) {
  const vals = points.map((p, i) => ({ p, i })).filter((x): x is { p: number; i: number } => x.p != null);
  if (vals.length < 2) return null;
  const w = 96;
  const h = 28;
  const x = (i: number) => (points.length === 1 ? w / 2 : (i / (points.length - 1)) * (w - 8) + 4);
  const y = (p: number) => h - 4 - (p / 100) * (h - 8);
  const d = vals.map((v, k) => `${k ? "L" : "M"}${x(v.i).toFixed(1)},${y(v.p).toFixed(1)}`).join(" ");
  const last = vals[vals.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={className} aria-hidden>
      <path d={d} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last.i)} cy={y(last.p)} r={4} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
