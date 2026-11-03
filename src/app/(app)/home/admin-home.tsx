import { Hourglass, UserMinus, UserPlus, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { DayStrip } from "@/components/teaching-log";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, ProgressBar, StatTile } from "@/components/ui/data";
import { formatMonth, formatTime } from "@/lib/format";
import type { adminDashboard } from "@/server/modules/dashboards";

type D = Awaited<ReturnType<typeof adminDashboard>>;

/** PRD §4.2 Admin home — counts only, never money. */
export function AdminHome({ d }: { d: D }) {
  const due = d.fees.total - d.fees.waived;
  const pct = due ? Math.round((d.fees.paid / due) * 100) : 0;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active students" value={d.students.active} icon={Users} href="/students" />
        <StatTile label="Admitted" value={d.students.addedThisMonth} sub="this month" icon={UserPlus} tone="success" href="/students" />
        <StatTile label="Left" value={d.students.removedThisMonth} sub="this month" icon={UserMinus} tone="neutral" href="/students?status=removed" />
        <StatTile label="Tests to publish" value={d.tests.total} sub={d.tests.overdue ? `${d.tests.overdue} older than 3 days` : "none overdue"} icon={Hourglass} tone={d.tests.overdue ? "danger" : "info"} href="/results" />
      </div>

      <Link href="/fees" className="block">
        <Card className="transition-colors hover:bg-surface-2">
          <CardHeader title={`Fees · ${formatMonth(d.month)}`} action={<Wallet className="size-5 text-muted" aria-hidden />} />
          <CardBody>
            {d.feesGenerated ? (
              <>
                <div className="flex items-end justify-between">
                  <p className="tabular text-3xl font-bold">
                    {d.fees.paid}
                    <span className="text-lg font-semibold text-muted"> / {due} paid</span>
                  </p>
                  <p className="tabular text-xl font-bold text-success-fg">{pct}%</p>
                </div>
                <ProgressBar className="mt-3" value={pct} tone="success" label="Fees paid" />
                <div className="mt-3 flex gap-2">
                  <StatusBadge status="paid" label={`${d.fees.paid} paid`} />
                  <StatusBadge status="unpaid" label={`${d.fees.unpaid} unpaid`} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">This month's fee list hasn't been created yet — open Fees to create it.</p>
            )}
          </CardBody>
        </Card>
      </Link>

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
                    <DayStrip size="sm" days={t.days.map((x) => ({ date: x.date, state: x.logged >= x.expected ? "done" : x.logged ? "partial" : "missed" }))} />
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
      <p className="text-center text-xs text-muted">Updated {formatTime(d.asOf)}</p>
    </div>
  );
}
