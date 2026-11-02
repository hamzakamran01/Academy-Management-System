import { AlertTriangle, ClipboardCheck, Hourglass, PenLine, UserMinus, UserPlus, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
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

      <Card>
        <CardHeader
          title="Teaching this week"
          description={`${d.teaching.missingPlans} plans not submitted · ${d.teaching.noLogToday} subjects without a log today`}
          action={<Link href="/progress" className="text-sm font-medium text-primary hover:underline">Open →</Link>}
        />
        {d.teaching.teachers.length ? (
          <ul className="divide-y divide-border border-t border-border">
            {d.teaching.teachers.map((t) => (
              <li key={t.teacherId}>
                <Link href={`/teachers/${t.teacherId}`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
                  <Avatar name={t.teacherName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.teacherName}</p>
                    <p className="line-clamp-2 text-[13px] text-muted">{t.reasons.join(" · ")}</p>
                  </div>
                  {t.reasons.some((r) => r.includes("Plan")) ? <ClipboardCheck className="size-5 text-warning" aria-label="Plan missing" /> : t.reasons.some((r) => r.includes("log")) ? <PenLine className="size-5 text-warning" aria-label="Log missing" /> : <AlertTriangle className="size-5 text-danger" aria-label="Behind" />}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <CardBody>
            <p className="text-sm text-muted">All teachers are up to date.</p>
          </CardBody>
        )}
      </Card>
      <p className="text-center text-xs text-muted">Updated {formatTime(d.asOf)}</p>
    </div>
  );
}
