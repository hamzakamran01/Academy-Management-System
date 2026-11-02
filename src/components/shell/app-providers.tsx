"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, type ReactNode } from "react";

const UnreadCtx = createContext(0);

/** Client-side app context: unread count + service worker registration. */
export function AppProviders({ unread, children }: { unread: number; children: ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return <UnreadCtx.Provider value={unread}>{children}</UnreadCtx.Provider>;
}

export const useUnread = () => useContext(UnreadCtx);

/** Bell with unread badge (phone header). */
export function BellLink({ className }: { className?: string }) {
  const unread = useUnread();
  return (
    <Link
      href="/notifications"
      className={className ?? "relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 lg:hidden"}
      aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="tabular absolute end-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-bg">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
