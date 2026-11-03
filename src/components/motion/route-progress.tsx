"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Fired by the bottom bar / any code that starts a navigation without a plain link click. */
export const ROUTE_START_EVENT = "campusly:route-start";

/**
 * Thin top progress bar: starts the instant an internal link is tapped and
 * completes when the new screen is in place — so a tap always feels answered,
 * even on a slow connection.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const start = () => {
      if (timer.current) clearTimeout(timer.current);
      setState("loading");
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(ROUTE_START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(ROUTE_START_EVENT, start);
    };
  }, []);

  // New URL rendered → finish and fade out.
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    timer.current = setTimeout(() => setState("idle"), 380);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname, search]);

  return (
    <div
      aria-hidden
      className="route-progress pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]"
      data-state={state}
    >
      <div className="h-full origin-left rounded-e-full bg-primary shadow-[0_0_8px_var(--primary)]" />
    </div>
  );
}
