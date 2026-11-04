import { cn } from "@/lib/cn";

/**
 * Solid colours for class badges, all dark enough for white text in both
 * themes. Order is fixed — changing it re-colours every class.
 */
const PALETTE = [
  "bg-[oklch(0.5_0.2_268)]", // indigo
  "bg-[oklch(0.52_0.17_240)]", // blue
  "bg-[oklch(0.52_0.1_195)]", // teal
  "bg-[oklch(0.52_0.13_155)]", // emerald
  "bg-[oklch(0.58_0.16_55)]", // orange
  "bg-[oklch(0.53_0.19_25)]", // red
  "bg-[oklch(0.52_0.19_350)]", // pink
  "bg-[oklch(0.5_0.2_305)]", // violet
] as const;

/** "Grade 9 – A" → "9A", "FSc Pre-Medical" → "FP": short text for the badge. */
export function classInitials(name: string): string {
  const num = name.match(/\d{1,2}/)?.[0];
  const section = name.match(/[–-]\s*([A-Z])\b/)?.[1] ?? "";
  if (num) return `${num}${section}`;
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Same class name → same colour on every screen (FNV-1a hash of the name). */
function colourFor(name: string): string {
  let h = 0x811c9dc5;
  for (const ch of name.trim().toLowerCase()) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return PALETTE[h % PALETTE.length]!;
}

/** A solid coloured square that stands for a class wherever it appears. */
export function ClassBadge({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-bold tracking-tight text-white shadow-xs",
        colourFor(name),
        size === "sm" && "size-9 rounded-lg text-xs",
        size === "md" && "size-11 text-[15px]",
        size === "lg" && "size-12 text-base",
        className,
      )}
      aria-hidden
    >
      {classInitials(name)}
    </span>
  );
}
