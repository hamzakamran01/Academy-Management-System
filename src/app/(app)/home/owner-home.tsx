import { Banknote, CircleDollarSign, ClipboardCheck, Hourglass, ServerCog, TrendingUp, UserMinus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { Avatar, StatTile } from "@/components/ui/data";
import { formatMoney, formatMoneyCompact, formatMonth, formatPercent, formatRelative, formatTime } from "@/lib/format";
import type { ownerDashboard } from "@/server/modules/dashboards";

type D = Awaited<ReturnType<typeof ownerDashboard>>;

/** PRD §4.2 Super Admin home: students, money, salaries, teaching, people needing attention. */
export function OwnerHome({ d }: { d: D }) {
  const f = d.finance;
  const pct = f.recoveryPct ?? 0;
  return (
    <div className="space-y-5">
      <Link href="/finance" className="block">
        <Card className="overflow-hidden transition-colors hover:bg-surface-2">
          <div className="bg-[linear-gradient(135deg,oklch(0.46_0.2_272),oklch(0.36_0.17_285))] p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-white/75">Recovered · {formatMonth(d.month)}</p>
                <p className="tabular mt-1 text-[32px] font-bold leading-10 tracking-tight">{formatMoney(f.recovered)}</p>
                <p className="text-sm text-white/75">
                  of <span className="tabular font-semibold text-white">{formatMoney(f.expected)}</span> expected
                </p>
              </div>
              <div className="rounded-2xl bg-white/12 px-3 py-2 text-center ring-1 ring-white/20">
                <p className="tabular text-2xl font-bold">{formatPercent(f.recoveryPct, 0)}</p>
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
          <CardHeader title="Teaching progress" description={`${d.teaching.total} class subjects`} action={<Link href="/progress" className="text-sm font-medium text-primary hover:underline">Open →</Link>} />
          <CardBody>
            <div className="grid grid-cols-3 gap-2">
              <Count label="On track" n={d.teaching.statusCounts.on_track} cls="bg-success-soft text-success-fg" href="/progress?status=on_track" />
              <Count label="At risk" n={d.teaching.statusCounts.at_risk} cls="bg-warning-soft text-warning-fg" href="/progress?status=at_risk" />
              <Count label="Behind" n={d.teaching.statusCounts.behind} cls="bg-danger-soft text-danger-fg" href="/progress?status=behind" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
              <Badge tone={d.teaching.missingPlans ? "warning" : "success"} icon={ClipboardCheck}>{d.teaching.missingPlans} plans not submitted</Badge>
              <Badge tone={d.tests.overdue ? "danger" : "neutral"} icon={Hourglass}>
                {d.tests.total} tests unpublished{d.tests.overdue ? ` · ${d.tests.overdue} overdue` : ""}
              </Badge>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Teachers needing attention" action={<Link href="/people-status" className="text-sm font-medium text-primary hover:underline">People →</Link>} />
          {d.teaching.teachers.length ? (
            <ul className="divide-y divide-border border-t border-border">
              {d.teaching.teachers.map((t) => (
                <li key={t.teacherId}>
                  <Link href={`/teachers/${t.teacherId}`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
                    <Avatar name={t.teacherName} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium">{t.teacherName}</p>
                      <p className="line-clamp-2 text-[13px] text-muted">{t.reasons.join(" · ")}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <p className="text-sm text-muted">Everyone is on top of plans and lesson logs. 🎉</p>
            </CardBody>
          )}
        </Card>
      </div>

      <SectionTitle>Students this month</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Admitted" value={d.students.addedThisMonth} icon={UserPlus} tone="success" href="/students" />
        <StatTile label="Left" value={d.students.removedThisMonth} icon={UserMinus} tone="neutral" href="/students?status=removed" />
      </div>

      <Card>
        <CardHeader title="System health" action={<ServerCog className="size-5 text-muted" aria-hidden />} />
        <CardBody className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <Health ok={!!d.health.lastMonthlyRun?.ok} label="Monthly lists" value={d.health.lastMonthlyRun ? `${formatMonth(d.health.lastMonthlyRun.month, true)} created` : "Not run yet"} />
          <Health ok={d.health.cronConfigured} label="Scheduler" value={d.health.lastJobAt ? `last run ${formatRelative(d.health.lastJobAt)}` : d.health.cronConfigured ? "waiting for first run" : "CRON_SECRET not set"} />
          <Health ok={d.health.pushConfigured && d.health.pushFailures24h === 0} label="Push notifications" value={!d.health.pushConfigured ? "VAPID keys not set" : `${d.health.pushFailures24h} failures in 24 h`} />
          <Health ok={d.health.failedJobs7d === 0} label="Job failures (7 days)" value={String(d.health.failedJobs7d)} />
        </CardBody>
      </Card>
      <p className="text-center text-xs text-muted">Updated {formatTime(d.asOf)}</p>
    </div>
  );
}

function Count({ label, n, cls, href }: { label: string; n: number; cls: string; href: string }) {
  return (
    <Link href={href} className={`rounded-xl px-2 py-2.5 text-center ${cls}`}>
      <p className="tabular text-xl font-bold">{n}</p>
      <p className="text-xs font-semibold">{label}</p>
    </Link>
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

