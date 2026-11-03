import { ChevronLeft, ChevronRight, ClipboardList, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { DayStrip, LogBody, LogPill } from "@/components/teaching-log";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { Card } from "@/components/ui/card";
import { Avatar, ProgressBar } from "@/components/ui/data";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { LinkTabs } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { addDays, isValidISODate, todayPkt } from "@/lib/dates";
import { formatDate, formatDateShort } from "@/lib/format";
import { uuidOrUndefined } from "@/lib/validation";
import { requireCtx } from "@/server/auth/session";
import { listClasses } from "@/server/modules/org";
import { teacherConsistency, teachingDay } from "@/server/modules/teaching";
import { ParentProgress } from "./parent-progress";

export const metadata: Metadata = { title: "Teaching log" };

type SP = { view?: string; date?: string; classId?: string; student?: string };

/**
 * Office view of the daily teaching log.
 *  · Day       — every class subject for one day: logged or not, what was taught, homework.
 *  · Teachers  — who logs consistently over the last two weeks.
 */
export default async function TeachingLogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  if (ctx.role === "parent") return <ParentProgress ctx={ctx} studentId={uuidOrUndefined(sp.student)} />;
  if (ctx.role === "teacher") redirect("/my-progress");

  const view = sp.view === "teachers" ? "teachers" : "day";
  const today = todayPkt();
  const date = sp.date && isValidISODate(sp.date) && sp.date <= today ? sp.date : today;
  const classId = uuidOrUndefined(sp.classId);
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ view: view === "teachers" ? "teachers" : undefined, date: date === today ? undefined : date, classId, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/progress${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Teaching log" subtitle="What teachers taught, and who is logging daily" />
      <LinkTabs
        tabs={[
          { key: "day", label: "By day", href: href({ view: undefined }) },
          { key: "teachers", label: "Teachers", href: href({ view: "teachers", date: undefined }) },
        ]}
        active={view}
      />
      {view === "day" ? <DayView ctx={ctx} date={date} today={today} classId={classId} href={href} /> : <TeachersView ctx={ctx} />}
    </>
  );
}

async function DayView({
  ctx,
  date,
  today,
  classId,
  href,
}: {
  ctx: Awaited<ReturnType<typeof requireCtx>>;
  date: string;
  today: string;
  classId?: string;
  href: (p: Partial<SP>) => string;
}) {
  const [day, classes] = await Promise.all([teachingDay(ctx, date, { classId }), listClasses(ctx)]);
  const pct = day.total ? Math.round((day.logged / day.total) * 100) : 0;
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const isPast = date < today;

  // Group by class for a calm, scannable page.
  const groups = new Map<string, typeof day.items>();
  for (const i of day.items) groups.set(i.className, [...(groups.get(i.className) ?? []), i]);

  return (
    <>
      {/* Date stepper */}
      <div className="mb-3 flex items-center gap-2">
        <Link href={href({ date: prev })} scroll={false} replace className="inline-flex size-11 items-center justify-center rounded-lg border border-border bg-surface shadow-xs transition-[background-color,transform] hover:bg-surface-2 active:scale-95" aria-label="Previous day">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex h-11 flex-1 flex-col items-center justify-center rounded-lg border border-border bg-surface shadow-xs">
          <span className="text-sm font-semibold leading-tight">{date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : formatDateShort(date)}</span>
          <span className="text-[11px] leading-tight text-muted">{formatDate(date)}</span>
        </div>
        {date < today ? (
          <Link href={href({ date: next === today ? undefined : next })} scroll={false} replace className="inline-flex size-11 items-center justify-center rounded-lg border border-border bg-surface shadow-xs transition-[background-color,transform] hover:bg-surface-2 active:scale-95" aria-label="Next day">
            <ChevronRight className="size-5" />
          </Link>
        ) : (
          <span className="inline-flex size-11 items-center justify-center rounded-lg border border-border text-subtle/40" aria-hidden>
            <ChevronRight className="size-5" />
          </span>
        )}
      </div>

      <form action="/progress" className="mb-4">
        {date !== today && <input type="hidden" name="date" value={date} />}
        <AutoSubmitSelect name="classId" defaultValue={classId ?? ""} className="h-10 text-sm" aria-label="Class">
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </AutoSubmitSelect>
      </form>

      {!day.isWorkingDay && (
        <Notice tone="info" className="mb-4">
          {day.holiday ? `Holiday — ${day.holiday}.` : "Not a working day."} Logs aren't expected.
        </Notice>
      )}

      {day.total === 0 ? (
        <EmptyState icon={ClipboardList} title="No class subjects" description="Add subjects to classes and assign teachers to see their daily logs here." />
      ) : (
        <>
          <Card className="mb-4 flex items-center gap-4 p-4">
            <p className="tabular text-3xl font-bold leading-none">
              {day.logged}
              <span className="text-lg font-semibold text-muted">/{day.total}</span>
            </p>
            <div className="min-w-0 flex-1">
              <ProgressBar value={pct} tone={pct === 100 ? "success" : "primary"} label="Logged" />
              <p className="mt-1.5 text-[13px] text-muted">{pct === 100 ? "Every class subject is logged" : `${day.total - day.logged} not logged ${date === today ? "yet" : ""}`}</p>
            </div>
            {pct === 100 && <PartyPopper className="size-6 shrink-0 text-success" aria-hidden />}
          </Card>

          <div className="space-y-5">
            {[...groups].map(([className, items]) => (
              <section key={className}>
                <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted">
                  {className}
                  <span className="tabular normal-case tracking-normal">{items.filter((i) => i.log).length}/{items.length} logged</span>
                </h2>
                <ul className="stagger divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
                  {items.map((i) => (
                    <li key={i.id}>
                      <Link href={`/progress/${i.id}`} className="block px-4 py-3 transition-colors hover:bg-surface-2 active:bg-surface-3">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{i.subjectName}</p>
                            <p className="truncate text-[13px] text-muted">{i.teacherName ?? "No teacher assigned"}</p>
                          </div>
                          <LogPill logged={!!i.log} missed={isPast && day.isWorkingDay} />
                        </div>
                        {i.log && <LogBody log={i.log} clamp className="mt-2" />}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}

async function TeachersView({ ctx }: { ctx: Awaited<ReturnType<typeof requireCtx>> }) {
  const rows = await teacherConsistency(ctx, { count: 10 });
  if (!rows.length) return <EmptyState icon={ClipboardList} title="No teachers assigned yet" description="Assign teachers to class subjects first." />;
  return (
    <>
      <p className="mb-3 px-1 text-[13px] text-muted">Last 10 working days (today not counted). Green = all subjects logged, amber = some, red = none.</p>
      <ul className="stagger divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        {rows.map((t) => (
          <li key={t.teacherId}>
            <Link href={`/teachers/${t.teacherId}`} className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={t.teacherName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.teacherName}</p>
                  <p className="text-[13px] text-muted">
                    {t.subjects} subject{t.subjects === 1 ? "" : "s"} · last log {t.lastLog ? formatDate(t.lastLog).slice(0, 6) : "—"}
                  </p>
                </div>
                <span
                  className={cn(
                    "tabular ms-auto shrink-0 rounded-full px-2.5 py-1 text-sm font-bold sm:hidden",
                    (t.pct ?? 0) >= 90 ? "bg-success-soft text-success-fg" : (t.pct ?? 0) >= 70 ? "bg-warning-soft text-warning-fg" : "bg-danger-soft text-danger-fg",
                  )}
                >
                  {t.pct ?? 0}%
                </span>
              </div>
              <div className="flex items-center gap-3 ps-11 sm:ps-0">
                <DayStrip days={t.days.map((d) => ({ date: d.date, state: d.logged >= d.expected ? "done" : d.logged ? "partial" : "missed" }))} />
                <span
                  className={cn(
                    "tabular hidden w-14 shrink-0 rounded-full px-2.5 py-1 text-center text-sm font-bold sm:inline-block",
                    (t.pct ?? 0) >= 90 ? "bg-success-soft text-success-fg" : (t.pct ?? 0) >= 70 ? "bg-warning-soft text-warning-fg" : "bg-danger-soft text-danger-fg",
                  )}
                >
                  {t.pct ?? 0}%
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
