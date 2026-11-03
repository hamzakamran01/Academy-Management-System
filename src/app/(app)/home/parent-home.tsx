import { ChevronRight, GraduationCap, Hourglass, Megaphone } from "lucide-react";
import Link from "next/link";
import { ChildSwitcher } from "@/components/child-switcher";
import { LogBody } from "@/components/teaching-log";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/data";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { todayPkt } from "@/lib/dates";
import { formatDate, formatMoney, formatMonth, formatPercent, formatRelative } from "@/lib/format";
import { fmtMark } from "@/lib/grades";
import type { parentDashboard } from "@/server/modules/dashboards";

type D = Awaited<ReturnType<typeof parentDashboard>>;

/** PRD §4.2 Parent home (attendance deferred): result, fee, this week, homework, announcement. */
export function ParentHome({ d }: { d: D }) {
  if (!d.child) return <EmptyState icon={GraduationCap} title="No active students linked" description="Contact the academy office if this is a mistake." />;
  const today = todayPkt();
  const r = d.latestResult;
  const fee = d.feeThisMonth;
  return (
    <div className="space-y-4">
      <ChildSwitcher kids={d.kids} active={d.child.id} basePath="/home" />
      <div className="flex items-center gap-3">
        <Avatar name={d.child.name} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{d.child.name}</p>
          <p className="truncate text-[13px] text-muted">{d.child.className ?? "—"}{d.child.rollNo ? ` · Roll ${d.child.rollNo}` : ""}</p>
        </div>
      </div>
      {d.child.readOnly && <Notice tone="warning">{d.child.name} has left the academy. You can view their records for 30 days.</Notice>}

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/results?student=${d.child.id}`} className="block">
          <Card className="h-full p-4 transition-colors hover:bg-surface-2">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
              <GraduationCap className="size-4" aria-hidden /> Latest result
            </p>
            {r ? (
              <>
                <p className="tabular mt-2 text-2xl font-bold">
                  {r.absent ? "Absent" : fmtMark(r.value!)}
                  {!r.absent && <span className="text-base font-medium text-muted">/{fmtMark(r.totalMarks)}</span>}
                </p>
                <p className="truncate text-[13px] text-muted">
                  {r.subjectName}
                  {r.pct != null && ` · ${r.pct}% · ${r.grade}`}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">No results yet</p>
            )}
          </Card>
        </Link>
        <Link href="/fees" className="block">
          <Card className="h-full p-4 transition-colors hover:bg-surface-2">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
              <Hourglass className="size-4" aria-hidden /> {formatMonth(today, true).split(" ")[0]} fee
            </p>
            {fee ? (
              <>
                <div className="mt-2">
                  <StatusBadge status={fee.status} size="md" />
                </div>
                <p className="tabular mt-1.5 text-[13px] text-muted">
                  {formatMoney(fee.amount)}
                  {fee.status === "paid" && fee.markedAt ? ` · ${formatDate(fee.markedAt.toISOString().slice(0, 10)).slice(0, 6)}` : ""}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Not issued yet</p>
            )}
            {d.unpaidMonths > 1 && <Badge tone="danger" className="mt-1.5">{d.unpaidMonths} months unpaid</Badge>}
          </Card>
        </Link>
      </div>

      {d.overall != null && (
        <Card className="flex items-center justify-between p-4">
          <p className="text-sm text-muted">Overall average this year</p>
          <p className="tabular text-lg font-bold">{formatPercent(d.overall)}</p>
        </Card>
      )}

      <Card>
        <CardHeader title="In class lately" description="What was taught and the homework" action={<Link href={`/progress?student=${d.child.id}`} className="text-sm font-medium text-primary hover:underline">See all →</Link>} />
        {d.recentClass.length ? (
          <ul className="divide-y divide-border border-t border-border">
            {d.recentClass.map((s) => (
              <li key={s.subjectName} className="px-4 py-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold">{s.subjectName}</p>
                  <span className="shrink-0 text-xs text-muted">{s.entry.date === today ? "Today" : formatDate(s.entry.date).slice(0, 6)}</span>
                </div>
                <LogBody log={s.entry} clamp />
              </li>
            ))}
          </ul>
        ) : (
          <CardBody>
            <p className="text-sm text-muted">Teachers haven't written any class logs in the last few days.</p>
          </CardBody>
        )}
      </Card>

      {d.announcement && (
        <Link href={`/announcements#a-${d.announcement.id}`} className="block">
          <Card className="flex items-start gap-3 p-4 transition-colors hover:bg-surface-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
              <Megaphone className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold [overflow-wrap:anywhere]">{d.announcement.title}</p>
              <p className="line-clamp-2 text-sm text-muted [overflow-wrap:anywhere]">{d.announcement.body}</p>
              <p className="mt-1 text-xs text-subtle">{formatRelative(d.announcement.publishedAt)}</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
          </Card>
        </Link>
      )}
    </div>
  );
}
