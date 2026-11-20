import { ArrowRight, Banknote, ChevronDown, CircleDollarSign, Hourglass, ServerCog, TrendingUp, UserMinus, UserPlus, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { Avatar, ProgressBar, StatTile } from "@/components/ui/data";
import { DayStrip } from "@/components/teaching-log";
import { formatMoney, formatMoneyCompact, formatMonth, formatPercent, formatRelative, formatTime } from "@/lib/format";
import type { ownerDashboard } from "@/server/modules/dashboards";

type D = Awaited<ReturnType<typeof ownerDashboard>>;

/** PRD §4.2 Super Admin home: students, money, salaries, teaching, people needing attention. */
export function OwnerHome({ d }: { d: D }) {
  const f = d.finance;
  const pct = f.recoveryPct ?? 0;
  return (
    <div className="space-y-5">
      <section aria-labelledby="owner-quick-actions" className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
        <h2 id="owner-quick-actions" className="text-lg font-bold tracking-tight">Quick actions</h2>
        <div className="mt-3 grid gap-2 min-[420px]:grid-cols-2 xl:grid-cols-3">
          <Link href="/students/new" className={buttonVariants({ className: "min-h-12 justify-start" })}><UserPlus aria-hidden /> Admit student <ArrowRight className="ms-auto" aria-hidden /></Link>
          <Link href="/fees" className={buttonVariants({ variant: "secondary", className: "min-h-12 justify-start" })}><Wallet aria-hidden /> Record payments <ArrowRight className="ms-auto" aria-hidden /></Link>
          <Link href="/fees/settings" className={buttonVariants({ variant: "secondary", className: "min-h-12 justify-start" })}><CircleDollarSign aria-hidden /> Set student fees <ArrowRight className="ms-auto" aria-hidden /></Link>
        </div>
      </section>

      {(f.feeNotSetCount > 0 || d.tests.overdue > 0) && (
        <section aria-label="Needs attention" className="flex flex-wrap gap-2">
          {f.feeNotSetCount > 0 && <Link href="/fees/settings?missing=1" className={buttonVariants({ variant: "secondary", className: "min-h-12" })}>{f.feeNotSetCount} {f.feeNotSetCount === 1 ? "student needs" : "students need"} a fee <ArrowRight aria-hidden /></Link>}
          {d.tests.overdue > 0 && <Link href="/results" className={buttonVariants({ variant: "secondary", className: "min-h-12" })}>{d.tests.overdue} overdue {d.tests.overdue === 1 ? "result" : "results"} <ArrowRight aria-hidden /></Link>}
        </section>
      )}

      <Link href="/finance" className="block" aria-label="Open finance summary">
        <Card className="overflow-hidden transition-colors hover:bg-surface-2">
          <div className="bg-[linear-gradient(135deg,oklch(0.46_0.2_272),oklch(0.36_0.17_285))] p-4 text-white sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-white/75">Recovered · {formatMonth(d.month)}</p>
                <p className="tabular mt-1 text-2xl font-bold leading-tight sm:text-4xl tracking-tight">{formatMoney(f.recovered)}</p>
                <p className="text-sm text-white/75">
                  of <span className="tabular font-semibold text-white">{formatMoney(f.expected)}</span> expected
                </p>
              </div>
              <div className="rounded-2xl bg-white/12 px-3 py-2 text-center ring-1 ring-white/20">
                <p className="tabular text-xl font-bold sm:text-2xl">{formatPercent(f.recoveryPct, 0)}</p>
                <p className="text-[11px] text-white/75">recovery</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <p className="mt-2 text-[13px] text-white/80">
              Pending <span className="tabular font-semibold text-white">{formatMoney(f.pending)}</span> · {f.counts.unpaid} students unpaid
            </p>
          </div>
        </Card>
      </Link>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active students" value={d.students.active.toLocaleString("en-PK")} sub={d.students.addedThisMonth || d.students.removedThisMonth ? `${d.students.addedThisMonth} joined · ${d.students.removedThisMonth} left this month` : "No changes this month"} icon={Users} href="/students" />
        <StatTile label="At current fees" value={formatMoneyCompact(f.revenueAtCurrentFees)} sub="If everyone pays" icon={CircleDollarSign} tone="success" href="/fees/settings" />
        <StatTile label="Salaries paid" value={formatMoneyCompact(d.salaries.salaryPaid)} sub={`of ${formatMoneyCompact(d.salaries.salaryBill)} · ${formatMoneyCompact(d.salaries.salaryPending)} pending`} icon={Banknote} tone="warning" href="/salaries" />
        <StatTile label="Net this month" value={formatMoneyCompact(d.salaries.net)} sub="Recovered − salaries paid" icon={TrendingUp} tone={d.salaries.net < 0 ? "danger" : "info"} href="/finance" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Teaching log"
            description={d.teaching.isWorkingDay ? "Daily logs written by teachers today" : "No classes today"}
            action={<Link href="/progress" className="text-sm font-medium text-primary hover:underline">Open →</Link>}
          />
          <CardBody>
            <Link href="/progress" className="flex items-center gap-4 rounded-xl bg-surface-2 p-3 transition-colors hover:bg-surface-3">
              <p className="tabular text-3xl font-bold leading-none">
                {d.teaching.logged}
                <span className="text-lg font-semibold text-muted">/{d.teaching.total}</span>
              </p>
              <div className="min-w-0 flex-1">
                <ProgressBar value={d.teaching.total ? (d.teaching.logged / d.teaching.total) * 100 : 0} tone={d.teaching.logged === d.teaching.total ? "success" : "primary"} label="Logged today" />
                <p className="mt-1.5 text-[13px] text-muted">class subjects logged today</p>
              </div>
            </Link>
            <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
              <Badge tone={d.tests.overdue ? "danger" : "neutral"} icon={Hourglass}>
                {d.tests.total} tests unpublished{d.tests.overdue ? ` · ${d.tests.overdue} overdue` : ""}
              </Badge>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Missed daily logs" description="Last 5 working days" action={<Link href="/progress?view=teachers" className="text-sm font-medium text-primary hover:underline">All teachers →</Link>} />
          {d.teaching.teachers.length ? (
            <ul className="divide-y divide-border border-t border-border">
              {d.teaching.teachers.map((t) => (
                <li key={t.teacherId}>
                  <Link href={`/teachers/${t.teacherId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <Avatar name={t.teacherName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.teacherName}</p>
                      <p className="text-[13px] text-muted">
                        {t.missedDays ? `Missed ${t.missedDays} day${t.missedDays === 1 ? "" : "s"}` : "Some subjects missed"} · {t.pct ?? 0}% logged
                      </p>
                    </div>
                    <div className="hidden min-[420px]:block"><DayStrip size="sm" days={t.days.map((x) => ({ date: x.date, state: x.logged >= x.expected ? "done" : x.logged ? "partial" : "missed" }))} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <p className="text-sm text-muted">Every teacher wrote their logs on each of the last 5 working days.</p>
            </CardBody>
          )}
        </Card>
      </div>

      <SectionTitle>Students this month</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Admitted" value={d.students.addedThisMonth} icon={UserPlus} tone="success" href="/students" />
        <StatTile label="Left" value={d.students.removedThisMonth} icon={UserMinus} tone="neutral" href="/students?status=removed" />
      </div>

      <details className="group rounded-xl border border-border bg-surface shadow-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
          <ServerCog className="size-5 text-muted" aria-hidden /> System health
          <ChevronDown className="ms-auto size-5 text-muted group-open:rotate-180" aria-hidden />
        </summary>
        <CardBody className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <Health ok={!!d.health.lastMonthlyRun?.ok} label="Monthly lists" value={d.health.lastMonthlyRun ? `${formatMonth(d.health.lastMonthlyRun.month, true)} created` : "Not run yet"} />
          <Health ok={d.health.cronConfigured} label="Scheduler" value={d.health.lastJobAt ? `last run ${formatRelative(d.health.lastJobAt)}` : d.health.cronConfigured ? "waiting for first run" : "CRON_SECRET not set"} />
          <Health ok={d.health.pushConfigured && d.health.pushFailures24h === 0} label="Push notifications" value={!d.health.pushConfigured ? "VAPID keys not set" : `${d.health.pushFailures24h} failures in 24 h`} />
          <Health ok={d.health.failedJobs7d === 0} label="Job failures (7 days)" value={String(d.health.failedJobs7d)} />
        </CardBody>
      </details>
      <p className="text-center text-xs text-muted">Updated {formatTime(d.asOf)}</p>
    </div>
  );
}

function Health({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5">
      <span className={`size-2.5 shrink-0 rounded-full ${ok ? "bg-success" : "bg-warning"}`} aria-hidden />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block truncate text-[13px] text-muted">{value}</span>
      </span>
      <span className="sr-only">{ok ? "OK" : "Needs attention"}</span>
    </div>
  );
}

