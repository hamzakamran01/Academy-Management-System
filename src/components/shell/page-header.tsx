import { ArrowLeft, Bell } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Sticky top app bar for every screen. On phones it carries the back button,
 * title and up to two actions; on desktop it becomes a roomy page title row.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
  bell = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  actions?: ReactNode;
  className?: string;
  /** Show the notification bell on phones (home screens). */
  bell?: boolean;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 -mx-4 mb-4 border-b border-transparent bg-bg/85 px-4 pt-safe backdrop-blur-xl sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mb-6 lg:bg-transparent lg:px-0 lg:backdrop-blur-none",
        className,
      )}
    >
      <div className="flex min-h-14 items-center gap-2 py-2 lg:min-h-0 lg:py-0">
        {back && (
          <Link
            href={back}
            className="-ms-2 inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-fg hover:bg-surface-2"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight lg:text-2xl">{title}</h1>
          {subtitle && <p className="truncate text-[13px] text-muted lg:mt-0.5 lg:text-sm">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        {bell && (
          <Link
            href="/notifications"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 lg:hidden"
            aria-label="Notifications"
          >
            <Bell className="size-5" />
          </Link>
        )}
      </div>
    </header>
  );
}

/** Primary action pinned above the bottom nav on phones, inline on desktop (UX-02). */
export function StickyActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-xl",
        "lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none",
        className,
      )}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2 lg:mx-0 lg:max-w-none lg:justify-end">{children}</div>
    </div>
  );
}
