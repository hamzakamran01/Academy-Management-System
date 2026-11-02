import Link from "next/link";
import { cn } from "@/lib/cn";

/** URL-driven tabs (server-rendered, shareable, back-button friendly). */
export function LinkTabs({ tabs, active, className }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string; className?: string }) {
  return (
    <nav
      className={cn("no-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0", className)}
      aria-label="Sections"
    >
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            scroll={false}
            replace
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative inline-flex h-11 shrink-0 items-center gap-1.5 px-3 text-sm font-medium transition-colors",
              on ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
            {t.count != null && (
              <span className={cn("rounded-full px-1.5 text-xs tabular", on ? "bg-primary-soft text-primary-soft-fg" : "bg-surface-3 text-muted")}>{t.count}</span>
            )}
            {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}
