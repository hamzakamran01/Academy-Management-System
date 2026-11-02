import { AlertTriangle, Banknote, CircleDollarSign, Hourglass, Landmark, Settings2, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RecoveryChart } from "@/components/charts/recovery-chart";
import { MonthPicker } from "@/components/month-picker";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, ProgressBar, StatTile } from "@/components/ui/data";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { monthStart, todayPkt } from "@/lib/dates";
import { formatMoney, formatMoneyCompact, formatMonth, formatPercent, formatTime } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { financeSummary, financeTrend, monthOptions } from "@/server/modules/fees";
import { GenerateButton } from "../fees/generate-button";

export const metadata: Metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

/** S-02 Finance — Super Admin only (FR-FEE-10, FR-FEE-11, BR-FEE-08). */
export default async function FinancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireCtx(["super_admin"]);
  const sp = await searchParams;
  const months = await monthOptions(ctx.academyId);
  const month = sp.month && months.includes(sp.month) ? sp.month : monthStart(todayPkt());
  const [f, trend] = await Promise.all([financeSummary(ctx, month), financeTrend(ctx, 12)]);
  const pct = f.recoveryPct ?? 0;

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle={`Updated ${formatTime(f.asOf)} · amounts visible only to you`}
        actions={
          <ButtonLink href="/fees/settings" variant="secondary" size="sm">
            <Settings2 aria-hidden /> <span className="hidden sm:inline">Fee settings</span>
          </ButtonLink>
        }
        bell
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MonthPicker months={months} value={month} />
        <Link href={`/fees?month=${month}`} className="text-sm font-medium text-primary hover:underline">
          Fee status by class →
        </Link>
      </div>

      {f.counts.total === 0 ? (
        <Card>
          <EmptyState
            icon={Banknote}
            title={`No fee rows for ${formatMonth(month)}`}
            description="Create the month's fee list to see expected and recovered revenue."
            action={<GenerateButton month={month} />}
          />
        </Card>
      ) : (
        <>
          {/* Hero: recovery */}
          <Card className="mb-4 overflow-hidden">
            <CardBody className="pt-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted">Recovered in {formatMonth(month)}</p>
                  <p className="tabular mt-1 text-4xl font-bold tracking-tight">{formatMoney(f.recovered)}</p>
                  <p className="mt-1 text-sm text-muted">
                    of <span className="tabular font-semibold text-fg">{formatMoney(f.expected)}</span> expected
                  </p>
                </div>
                <div className="text-end">
                  <p className="tabular text-3xl font-bold text-primary">{formatPercent(f.recoveryPct)}</p>
                  <p className="text-sm text-muted">recovery</p>
                </div>
              </div>
              <ProgressBar className="mt-4" value={pct} tone={pct >= 85 ? "success" : pct >= 60 ? "primary" : "warning"} label="Recovery" />
              <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
                <Badge tone="success">{f.counts.paid} paid</Badge>
                <Badge tone="warning">{f.counts.unpaid} unpaid</Badge>
                {f.counts.waived > 0 && <Badge>{f.counts.waived} waived ({formatMoney(f.waivedAmount)})</Badge>}
              </div>
            </CardBody>
          </Card>

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Expected" value={formatMoneyCompact(f.expected)} sub="Excl. waived" icon={CircleDollarSign} tone="info" />
            <StatTile label="Pending" value={formatMoneyCompact(f.pending)} sub={`${f.counts.unpaid} students`} icon={Hourglass} tone="warning" />
            <StatTile label="Active students" value={f.activeStudents.toLocaleString("en-PK")} icon={Users} tone="primary" href="/students" />
            <StatTile label="At current fees" value={formatMoneyCompact(f.revenueAtCurrentFees)} sub="If everyone pays / month" icon={Landmark} tone="success" />
          </div>

          {f.feeNotSetCount > 0 && (
            <Notice tone="warning" icon={AlertTriangle} className="mb-4" title={`${f.feeNotSetCount} active student${f.feeNotSetCount === 1 ? " has" : "s have"} no fee set`}>
              Their monthly rows are Rs 0. <Link href="/fees/settings" className="font-semibold underline">Set class fees</Link>
            </Notice>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Last 12 months" description="Recovered against expected each month" action={<TrendingUp className="size-5 text-muted" aria-hidden />} />
              <CardBody>
                <RecoveryChart data={trend} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="By class" description={formatMonth(month)} />
              <ul className="divide-y divide-border border-t border-border">
                {f.byClass.map((c) => {
                  const p = c.expected ? (c.recovered / c.expected) * 100 : 0;
                  return (
                    <li key={c.classId}>
                      <Link href={`/fees/class/${c.classId}?month=${month}`} className="block px-4 py-3 hover:bg-surface-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate font-medium">{c.name}</p>
                          <p className="tabular text-sm font-semibold">{formatPercent(p)}</p>
                        </div>
                        <ProgressBar className="my-2" size="sm" value={p} tone={p >= 85 ? "success" : p >= 60 ? "primary" : "warning"} label={`${c.name} recovery`} />
                        <p className="tabular text-[13px] text-muted">
                          {formatMoney(c.recovered)} of {formatMoney(c.expected)} · pending {formatMoney(c.pending)} · {c.students} students
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader title="Unpaid this month" description={`${f.unpaid.length} students · ${formatMoney(f.pending)} pending`} action={<Link href="/fees/unpaid" className="text-sm font-medium text-primary hover:underline">2+ months →</Link>} />
            {f.unpaid.length === 0 ? (
              <EmptyState icon={Banknote} title="Everyone has paid" className="py-8" />
            ) : (
              <ul className="grid grid-cols-1 divide-y divide-border border-t border-border md:grid-cols-2 md:divide-y-0">
                {f.unpaid.map((u) => (
                  <li key={u.rowId} className="md:border-b md:border-border md:odd:border-e">
                    <Link href={`/students/${u.studentId}?tab=fees`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                      <Avatar name={u.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{u.name}</p>
                        <p className="truncate text-[13px] text-muted">{u.className}</p>
                      </div>
                      {u.monthsUnpaid >= 2 && <Badge tone="danger">{u.monthsUnpaid} mo</Badge>}
                      <span className="tabular text-sm font-semibold">{formatMoney(u.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
