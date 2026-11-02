import { Banknote, Lock } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { mySalary } from "@/server/modules/salaries";

export const metadata: Metadata = { title: "My salary" };
export const dynamic = "force-dynamic";

/** T-14 / FR-SAL-03: only ever your own salary. */
export default async function MySalaryPage() {
  const ctx = await requireCtx(["teacher", "admin"]);
  const s = await mySalary(ctx);
  return (
    <>
      <PageHeader title="My salary" back="/more" />
      <Card className="mb-4 overflow-hidden">
        <div className="bg-[linear-gradient(135deg,var(--success-soft),var(--surface)_75%)] p-5">
          <p className="text-sm text-muted">Monthly salary</p>
          <p className="tabular mt-1 text-3xl font-bold tracking-tight">{s.current ? formatMoney(s.current.amount) : "Not set"}</p>
          {s.current && <p className="mt-1 text-sm text-muted">Since {formatMonth(s.current.from)}</p>}
        </div>
        <p className="flex items-center gap-1.5 border-t border-border px-5 py-2.5 text-xs text-muted">
          <Lock className="size-3.5" aria-hidden /> Private — only you and the owner can see this.
        </p>
      </Card>
      {s.rows.length === 0 ? (
        <EmptyState icon={Banknote} title="No salary months yet" />
      ) : (
        <Card>
          <CardHeader title="Month by month" />
          <ul className="divide-y divide-border border-t border-border">
            {s.rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{formatMonth(r.month)}</p>
                  <p className="text-[13px] text-muted">{r.status === "paid" && r.paidOn ? `Paid on ${formatDate(r.paidOn)}` : "Pending"}</p>
                </div>
                <span className="tabular text-sm font-semibold">{formatMoney(r.amount)}</span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
