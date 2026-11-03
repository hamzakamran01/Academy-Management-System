import { ClipboardList, Flame } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { DayStrip, LogBody } from "@/components/teaching-log";
import { Card, SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { todayPkt } from "@/lib/dates";
import { formatDate, formatDateShort } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { myRecentLogs, teacherConsistency, teacherToday } from "@/server/modules/teaching";

export const metadata: Metadata = { title: "My logs" };

/** Teacher: my streak, how consistently I've logged, and everything I wrote recently. */
export default async function MyLogsPage() {
  const ctx = await requireCtx(["teacher"]);
  const [today, [mine], logs] = await Promise.all([teacherToday(ctx), teacherConsistency(ctx, { count: 10, teacherId: ctx.userId }), myRecentLogs(ctx, 21)]);
  const t = todayPkt();

  // Group by day, newest first.
  const byDay = new Map<string, typeof logs>();
  for (const l of logs) byDay.set(l.date, [...(byDay.get(l.date) ?? []), l]);

  return (
    <>
      <PageHeader title="My logs" subtitle="What you've taught, day by day" back="/home" />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
            <Flame className="size-4 text-warning" aria-hidden /> Streak
          </p>
          <p className="tabular mt-1 text-2xl font-bold">
            {today.streak} <span className="text-sm font-medium text-muted">day{today.streak === 1 ? "" : "s"}</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted">Last 10 working days</p>
          <p className="tabular mt-1 text-2xl font-bold">{mine?.pct ?? 0}%</p>
        </Card>
      </div>
      {mine && (
        <Card className="mb-6 p-4">
          <p className="mb-3 text-[13px] text-muted">Each bar is one working day — green means every class was logged.</p>
          <DayStrip showLabels days={mine.days.map((d) => ({ date: d.date, state: d.logged >= d.expected ? "done" : d.logged ? "partial" : "missed" }))} />
        </Card>
      )}

      {byDay.size === 0 ? (
        <EmptyState icon={ClipboardList} title="No logs yet" description="After each class, tap “Write log” on the Today screen." />
      ) : (
        <div className="space-y-5">
          {[...byDay].map(([date, items]) => (
            <section key={date}>
              <SectionTitle>{date === t ? "Today" : `${formatDateShort(date)}`}</SectionTitle>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
                {items.map((l) => (
                  <li key={l.id}>
                    <Link href={`/lesson/${l.classSubjectId}?date=${l.date}`} className="block px-4 py-3 transition-colors hover:bg-surface-2">
                      <p className="mb-1 text-sm font-semibold">
                        {l.subjectName} <span className="font-normal text-muted">· {l.className}</span>
                      </p>
                      <LogBody log={l} clamp />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-center text-xs text-muted">Showing the last 3 weeks · since {formatDate(logs[logs.length - 1]!.date)}</p>
        </div>
      )}
    </>
  );
}
