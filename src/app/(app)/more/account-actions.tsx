"use client";

import { LogOut, Repeat2, Smartphone } from "lucide-react";
import { SectionTitle } from "@/components/ui/card";
import { ListCard } from "@/components/ui/data";
import { useLogout, useSwitchRole } from "@/components/shell/nav";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function AccountActions({ role, roles }: { role: Role; roles: Role[] }) {
  const switchRole = useSwitchRole();
  const logout = useLogout();
  const others = roles.filter((r) => r !== role);
  return (
    <section>
      <SectionTitle>Account</SectionTitle>
      <div className="mb-3 flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-3 shadow-card">
        <span className="ps-1 text-[15px] font-medium">Appearance</span>
        <ThemeToggle className="w-48" />
      </div>
      <ListCard>
        {others.map((r) => (
          <button key={r} onClick={() => switchRole(r)} className="flex min-h-14 w-full items-center gap-3 px-4 text-start text-[15px] font-medium hover:bg-surface-2">
            <Repeat2 className="size-5 text-muted" aria-hidden />
            Switch to {ROLE_LABEL[r]}
          </button>
        ))}
        <Link href="/install" className="flex min-h-14 items-center gap-3 px-4 text-[15px] font-medium hover:bg-surface-2">
          <Smartphone className="size-5 text-muted" aria-hidden />
          Install app & notifications
        </Link>
        <button onClick={logout} className="flex min-h-14 w-full items-center gap-3 px-4 text-start text-[15px] font-medium text-danger-fg hover:bg-danger-soft">
          <LogOut className="size-5" aria-hidden />
          Sign out
        </button>
      </ListCard>
    </section>
  );
}
