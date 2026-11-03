import { AlertTriangle, ChevronRight, Receipt, Settings2, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MonthPicker } from "@/components/month-picker";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { Avatar, ProgressBar } from "@/components/ui/data";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { monthStart, todayPkt } from "@/lib/dates";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { isStaffAdmin } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { feeOverview, monthOptions, parentFees } from "@/server/modules/fees";
import { myChildren } from "@/server/modules/students";
import { GenerateButton } from "./generate-button";

export const metadata: Metadata = { title: "Fees" };

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin", "parent"]);
  if (ctx.role === "parent") return <ParentFees ctx={ctx} />;

  const sp = await searchParams;
  const months = await monthOptions(ctx.academyId);
  const current = monthStart(todayPkt());
  const month = sp.month && months.includes(sp.month) ? sp.month : current;
  const o = await feeOverview(ctx, month);
  const admin = isStaffAdmin(ctx.role);
  const pctPaid = o.totals.total ? Math.round((o.totals.paid / (o.totals.total - o.totals.waived || 1)) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Fees"
        subtitle="Paid / unpaid status by class"
        actions={
          ctx.role === "super_admin" && (
            <ButtonLink href="/fees/settings" variant="secondary" size="sm">
              <Settings2 aria-hidden /> <span className="hidden sm:inline">Fee settings</span>
            </ButtonLink>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MonthPicker months={months} value={month} />
        {admin && (
          <ButtonLink href="/fees/unpaid" variant="soft" size="sm">
            <AlertTriangle aria-hidden /> Unpaid 2+ months
          </ButtonLink>
        )}
      </div>

      {!o.generated ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title={`${formatMonth(month)} fee list not created yet`}
            description={admin ? "It's created automatically on the 1st at 00:05. You can create it now — running it twice never duplicates." : "The office creates the monthly fee list on the 1st."}
            action={admin && <GenerateButton month={month} />}
          />
        </Card>
      ) : (
        <>
          <Card className="mb-5">
            <CardBody className="pt-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">{ctx.role === "teacher" ? "Your classes" : "All classes"} · {formatMonth(month)}</p>
                  <p className="tabular mt-1 text-3xl font-bold tracking-tight">
                    {o.totals.paid}
                    <span className="text-lg font-semibold text-muted"> / {o.totals.total - o.totals.waived} paid</span>
                  </p>
                </div>
                <p className="tabular text-2xl font-bold text-success-fg">{pctPaid}%</p>
              </div>
              <ProgressBar className="mt-3" value={pctPaid} tone="success" label="Paid" />
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status="paid" label={`${o.totals.paid} paid`} />
                <StatusBadge status="unpaid" label={`${o.totals.unpaid} unpaid`} />
                {o.totals.waived > 0 && <StatusBadge status="waived" label={`${o.totals.waived} waived`} />}
              </div>
            </CardBody>
          </Card>

          <SectionTitle>By class</SectionTitle>
          {o.classes.length === 0 ? (
            <EmptyState icon={Wallet} title="No classes" description="You're not assigned to any class yet." />
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {o.classes.map((c) => {
                const due = c.total - c.waived;
                const pct = due ? Math.round((c.paid / due) * 100) : 0;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/fees/class/${c.id}?month=${month}`}
                      className="group block rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2 active:bg-surface-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{c.name}</p>
                        <ChevronRight className="size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </div>
                      <p className="mt-1 text-[13px] text-muted">
                        <span className="tabular font-semibold text-success-fg">Paid {c.paid}</span> ·{" "}
                        <span className="tabular font-semibold text-warning-fg">Unpaid {c.unpaid}</span>
                        {c.waived > 0 && <> · Waived {c.waived}</>} · Total {c.total}
                      </p>
                      <ProgressBar className="mt-3" size="sm" value={pct} tone={pct >= 80 ? "success" : pct >= 50 ? "primary" : "warning"} label={`${c.name} paid`} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}

/** FR-FEE-12 / P-07: each month with amount and status per child. */
async function ParentFees({ ctx }: { ctx: Awaited<ReturnType<typeof requireCtx>> }) {
  const [kids, rows] = await Promise.all([myChildren(ctx), parentFees(ctx)]);
  if (!kids.length) return <EmptyState icon={Wallet} title="No children linked" description="Contact the academy office." />;
  return (
    <>
      <PageHeader title="Fees" subtitle="Monthly fee status" bell />
      <div className="space-y-6">
        {kids.map((k) => {
          const mine = rows.filter((r) => r.studentId === k.id);
          const unpaid = mine.filter((r) => r.status === "unpaid");
          return (
            <section key={k.id}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={k.name} />
                <div>
                  <p className="font-semibold">{k.name}</p>
                  <p className="text-[13px] text-muted">{k.className ?? "—"}</p>
                </div>
              </div>
              {unpaid.length > 0 && (
                <Notice tone="warning" className="mb-3" title={`${unpaid.length} month${unpaid.length === 1 ? "" : "s"} unpaid`}>
                  {formatMoney(unpaid.reduce((n, r) => n + r.amount, 0))} due — please pay at the academy office.
                </Notice>
              )}
              <Card>
                <CardHeader title="Month by month" />
                <ul className="divide-y divide-border border-t border-border">
                  {mine.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{formatMonth(r.month)}</p>
                        <p className="text-[13px] text-muted">
                          {r.status === "paid" && r.markedAt ? `Paid on ${formatDate(r.markedAt.toISOString().slice(0, 10))}` : r.status === "waived" ? "Waived" : "Not paid yet"}
                        </p>
                      </div>
                      <span className="tabular text-sm font-semibold">{formatMoney(r.amount)}</span>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                  {!mine.length && <li className="px-4 py-6 text-center text-sm text-muted">No fee months yet.</li>}
                </ul>
              </Card>
            </section>
          );
        })}
      </div>
    </>
  );
}
