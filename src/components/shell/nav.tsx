"use client";

import { Bell, ChevronsUpDown, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/data";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { BOTTOM_NAV, isActive, MENU } from "@/lib/nav";
import { ROLE_LABEL, type Role } from "@/lib/roles";

/** Phone: fixed bottom tab bar, 5 tabs, thumb-reachable (UX-02). */
export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = BOTTOM_NAV[role];
  // "More" lights up for any route not owned by another tab
  const owned = items.slice(0, -1).some((i) => isActive(pathname, i));
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/92 pb-safe shadow-nav backdrop-blur-xl lg:hidden"
      aria-label="Main"
    >
      <ul className="mx-auto grid h-[var(--nav-h)] max-w-xl grid-cols-5">
        {items.map((item, i) => {
          const active = i === items.length - 1 ? !owned : isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium"
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active ? "bg-primary-soft text-primary-soft-fg" : "text-muted group-active:bg-surface-2",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.9} aria-hidden />
                </span>
                <span className={cn("leading-none", active ? "font-semibold text-fg" : "text-muted")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop (≥1024 px): grouped left sidebar with account footer. */
export function Sidebar({
  role,
  roles,
  name,
  academyName,
  unread,
}: {
  role: Role;
  roles: Role[];
  name: string;
  academyName: string;
  unread: number;
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-[264px] flex-col border-e border-border bg-surface lg:flex">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo subtitle={academyName} />
        <Link
          href="/notifications"
          className="relative inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell className="size-5" />
          {unread > 0 && <span className="absolute end-2 top-2 size-2 rounded-full bg-danger ring-2 ring-surface" />}
        </Link>
      </div>
      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {MENU[role].map((group) => (
          <div key={group.label} className="mt-4 first:mt-2">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                        active ? "bg-primary-soft text-primary-soft-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <AccountBox role={role} roles={roles} name={name} />
    </aside>
  );
}

function AccountBox({ role, roles, name }: { role: Role; roles: Role[]; name: string }) {
  const [open, setOpen] = useState(false);
  const switchRole = useSwitchRole();
  const logout = useLogout();
  return (
    <div className="relative border-t border-border p-3">
      {open && (
        <div className="absolute inset-x-3 bottom-full mb-2 rounded-xl border border-border bg-surface p-1.5 shadow-raised">
          <ThemeToggle className="mb-1.5" />
          <Link href="/profile" className="flex h-10 items-center rounded-lg px-3 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>
            Profile & security
          </Link>
          {roles.filter((r) => r !== role).map((r) => (
            <button key={r} onClick={() => switchRole(r)} className="flex h-10 w-full items-center rounded-lg px-3 text-sm hover:bg-surface-2">
              Switch to {ROLE_LABEL[r]}
            </button>
          ))}
          <button onClick={logout} className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-danger-fg hover:bg-danger-soft">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-lg p-2 text-start hover:bg-surface-2"
        aria-expanded={open}
      >
        <Avatar name={name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="block text-xs text-muted">{ROLE_LABEL[role]}</span>
        </span>
        <ChevronsUpDown className="size-4 text-subtle" />
      </button>
    </div>
  );
}

export function useSwitchRole() {
  const router = useRouter();
  return async (role: Role) => {
    try {
      await api("/auth/switch-role", { body: { role } });
      toast.success(`Switched to ${ROLE_LABEL[role]}`);
      router.replace("/home");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
}

export function useLogout() {
  const router = useRouter();
  return async () => {
    await api("/auth/logout", { body: {} }).catch(() => {});
    // Drop cached pages on shared phones (SRS §8.2: cleared on logout).
    navigator.serviceWorker?.controller?.postMessage("clear");
    router.replace("/login");
    router.refresh();
  };
}
