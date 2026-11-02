import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/data";
import { SectionTitle } from "@/components/ui/card";
import { MENU } from "@/lib/nav";
import { formatPhone } from "@/lib/phone";
import { ROLE_LABEL } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { AccountActions } from "./account-actions";

export const metadata: Metadata = { title: "More" };

export default async function MorePage() {
  const ctx = await requireCtx();
  return (
    <>
      <PageHeader title="More" />
      <Link href="/profile" className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-card hover:bg-surface-2">
        <Avatar name={ctx.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{ctx.name}</p>
          <p className="text-sm text-muted">
            {ROLE_LABEL[ctx.role]} · {formatPhone(ctx.phone)}
          </p>
        </div>
        <ChevronRight className="size-5 text-subtle" />
      </Link>

      <div className="space-y-5">
        {MENU[ctx.role].map((group) => (
          <section key={group.label}>
            <SectionTitle>{group.label}</SectionTitle>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {group.items.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface p-3 text-center shadow-card transition-colors hover:bg-surface-2 active:bg-surface-3"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-[13px] font-medium leading-tight">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <AccountActions role={ctx.role} roles={ctx.roles} />
      </div>
    </>
  );
}
