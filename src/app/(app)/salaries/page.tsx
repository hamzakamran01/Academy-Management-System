import { Banknote, CheckCircle2, Hourglass, Users } from "lucide-react";
import type { Metadata } from "next";
import { MonthPicker } from "@/components/month-picker";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/data";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { addMonths, monthStart, todayPkt } from "@/lib/dates";
import { formatMoneyCompact, formatMonth } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { monthOptions } from "@/server/modules/fees";
import { salariesOverview } from "@/server/modules/salaries";
import { GenerateSalariesButton, SalaryList } from "./salaries-client";

export const metadata: Metadata = { title: "Salaries" };
export const dynamic = "force-dynamic";

/** S-04 — Super Admin only (FR-SAL-05). */
export default async function SalariesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireCtx(["super_admin"]);
  const sp = await searchParams;
  const months = await monthOptions(ctx.academyId);
  const cur = monthStart(todayPkt());
  const month = sp.month && months.includes(sp.month) ? sp.month : cur;
  const o = await salariesOverview(ctx, month);
  const effectiveMonths = [cur, addMonths(cur, 1), addMonths(cur, 2)];

  return (
    <>
      <PageHeader title="Salaries" subtitle="Visible only to you" back="/finance" />
      <div className="mb-4">
        <MonthPicker months={months} value={month} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Salary bill" value={formatMoneyCompact(o.totals.bill)} sub={formatMonth(month)} icon={Banknote} />
        <StatTile label="Paid" value={formatMoneyCompact(o.totals.paid)} icon={CheckCircle2} tone="success" />
        <StatTile label="Pending" value={formatMoneyCompact(o.totals.pending)} icon={Hourglass} tone="warning" />
        <StatTile label="Staff" value={o.items.length} sub={o.totals.notSet ? `${o.totals.notSet} without salary` : "all set"} icon={Users} tone="info" />
      </div>
      {!o.totals.generated && o.items.length > 0 && (
        <Card className="mb-4">
          <EmptyState
            icon={Banknote}
            title={`${formatMonth(month)} salary list not created`}
            description="It's created automatically on the 1st with the fee list. Set salaries first, then create it."
            action={<GenerateSalariesButton month={month} />}
            className="py-8"
          />
        </Card>
      )}
      {o.totals.notSet > 0 && (
        <Notice tone="warning" className="mb-4">
          {o.totals.notSet} staff member{o.totals.notSet === 1 ? " has" : "s have"} no salary set — tap the pencil to set it.
        </Notice>
      )}
      {o.items.length === 0 ? (
        <EmptyState icon={Users} title="No teachers or admin staff yet" />
      ) : (
        <SalaryList
          items={o.items.map((i) => ({ ...i, row: i.row && { ...i.row, paidOn: i.row.paidOn } }))}
          months={effectiveMonths}
          today={todayPkt()}
        />
      )}
    </>
  );
}
