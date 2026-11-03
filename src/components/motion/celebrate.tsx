"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/mascot";

/**
 * A short, dismissible success moment (≈1.6 s) for meaningful completions —
 * a daily log written, results published. Not for every small save.
 *
 *   celebrate({ title: "Log saved", subtitle: "5-day streak" })
 */
export type Celebration = { title: string; subtitle?: string; mood?: "happy" | "proud" };

const EVENT = "campusly:celebrate";

export function celebrate(c: Celebration) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Celebration>(EVENT, { detail: c }));
  try {
    navigator.vibrate?.(18);
  } catch {
    /* unsupported */
  }
}

const DOTS = Array.from({ length: 14 }, (_, i) => i);

export function CelebrationHost() {
  const [c, setC] = useState<(Celebration & { key: number }) | null>(null);

  useEffect(() => {
    const on = (e: Event) => setC({ ...(e as CustomEvent<Celebration>).detail, key: Date.now() });
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  useEffect(() => {
    if (!c) return;
    const t = setTimeout(() => setC(null), 1700);
    return () => clearTimeout(t);
  }, [c]);

  if (!c) return null;
  return (
    <div
      key={c.key}
      className="celebrate-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-bg/55 p-6 backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
      onClick={() => setC(null)}
    >
      <div className="celebrate-card relative flex w-full max-w-[280px] flex-col items-center rounded-2xl border border-border bg-surface px-6 pb-6 pt-4 text-center shadow-raised">
        <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center" aria-hidden>
          {DOTS.map((i) => (
            <span
              key={i}
              className="celebrate-dot absolute size-1.5 rounded-full"
              style={
                {
                  "--a": `${(360 / DOTS.length) * i}deg`,
                  "--d": `${54 + (i % 3) * 14}px`,
                  background: ["var(--primary)", "var(--success)", "var(--warning)", "var(--info)"][i % 4],
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <Mascot mood={c.mood ?? "proud"} className="pop-in size-24" />
        <p className="mt-2 text-lg font-bold tracking-tight">{c.title}</p>
        {c.subtitle && <p className="mt-0.5 text-sm text-muted">{c.subtitle}</p>}
      </div>
    </div>
  );
}
