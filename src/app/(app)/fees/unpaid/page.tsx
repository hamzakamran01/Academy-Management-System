import { PartyPopper, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { formatMoney, formatMonth } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { unpaidMultiple } from "@/server/modules/fees";

export const metadata: Metadata = { title: "Unpaid 2+ months" };

export default async function UnpaidPage() {
  const ctx = await requireCtx(["super_admin", "admin"]);
  const rows = await unpaidMultiple(ctx);
  const total = rows.reduce((n, r) => n + ("amount" in r ? (r.amount as number) : 0), 0);
  return (
    <>
      <PageHeader
        title="Unpaid 2+ months"
        subtitle={`${rows.length} student${rows.length === 1 ? "" : "s"} to follow up${ctx.role === "super_admin" && rows.length ? ` · ${formatMoney(total)} outstanding` : ""}`}
        back="/fees"
      />
      {rows.length === 0 ? (
        <EmptyState icon={PartyPopper} title="Nobody is 2+ months behind" description="Great collection discipline." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          {rows.map((r) => (
            <li key={r.studentId}>
              <Link href={`/students/${r.studentId}?tab=fees`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
                <Avatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{r.name}</p>
                    {r.status === "removed" && <StatusBadge status="removed" />}
                  </div>
                  <p className="text-[13px] text-muted">{r.className ?? "—"} · {r.registrationNo}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.months.map((m) => (
                      <Badge key={m} tone="warning">{formatMonth(m, true)}</Badge>
                    ))}
                  </div>
                </div>
                <div className="text-end">
                  <p className="tabular text-lg font-bold text-danger-fg">{r.months.length}</p>
                  <p className="text-xs text-muted">months</p>
                  {"amount" in r && <p className="tabular mt-1 text-sm font-semibold">{formatMoney(r.amount as number)}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[13px] text-muted">
        <Phone className="size-3.5" aria-hidden /> Parent numbers are on each student's profile.
      </p>
    </>
  );
}
