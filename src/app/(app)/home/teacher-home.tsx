import { ChevronRight, ClipboardList, FilePlus2, Flame, GraduationCap, PenLine, Sun } from "lucide-react";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { DayStrip, LogBody, LogPill } from "@/components/teaching-log";
import { ButtonLink } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { teacherDashboard } from "@/server/modules/dashboards";

type D = Awaited<ReturnType<typeof teacherDashboard>>;

/** Teacher "Today": write today's log for each class, see the streak, finish tests. */
export function TeacherHome({ d }: { d: D }) {
  const { log, drafts } = d;
  if (!log.items.length) return <EmptyState icon={ClipboardList} title="No classes assigned yet" description="Ask the office to assign you to class subjects." />;
  const done = log.items.filter((i) => i.log).length;
  const total = log.items.length;
  const allDone = done === total;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="space-y-5">
      {/* Today at a glance */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 p-4">
          <ProgressRing pct={pct} label={`${done}/${total}`} done={allDone} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {!log.isWorkingDay ? (log.holiday ? `Holiday · ${log.holiday}` : "No classes today") : allDone ? "All of today's logs are done" : `${total - done} log${total - done === 1 ? "" : "s"} to write today`}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
              {log.streak > 0 ? (
                <>
                  <Flame className="size-4 text-warning" aria-hidden />
                  <span>
                    <span className="tabular font-semibold text-fg">{log.streak}</span>-day streak — keep it going
                  </span>
                </>
              ) : (
                "Write a short log after each class"
              )}
            </p>
            <div className="mt-2.5">
              <DayStrip size="sm" days={log.strip.map((s) => ({ date: s.date, state: s.done ? "done" : s.partial ? "partial" : s.date === log.today ? "open" : "missed" }))} />
            </div>
          </div>
          {allDone && log.isWorkingDay && <Mascot mood="proud" className="hidden size-16 shrink-0 sm:block" />}
        </div>
      </Card>

      {drafts.length > 0 && (
        <Notice tone="info" icon={GraduationCap} title={`${drafts.length} test${drafts.length === 1 ? "" : "s"} waiting for marks`}>
          {drafts.slice(0, 3).map((t) => (
            <Link key={t.id} href={`/results/${t.id}`} className="block font-medium underline underline-offset-2">
              {t.subjectName} · {t.className} — {t.title}
            </Link>
          ))}
        </Notice>
      )}

      <section>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <Sun className="size-3.5" aria-hidden /> Today · {formatDate(log.today)}
          </span>
        </SectionTitle>
        <ul className="stagger grid grid-cols-1 gap-3 md:grid-cols-2">
          {log.items.map((s) => (
            <li key={s.id}>
              <Card className={cn("flex h-full flex-col p-4", !s.log && log.isWorkingDay && "border-primary/30")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.subjectName}</p>
                    <p className="truncate text-[13px] text-muted">{s.className}</p>
                  </div>
                  <LogPill logged={!!s.log} />
                </div>
                {s.log ? (
                  <Link href={`/lesson/${s.id}`} className="group mt-3 flex items-start gap-2 rounded-lg bg-surface-2 p-3 transition-colors hover:bg-surface-3">
                    <LogBody log={s.log} clamp className="flex-1" />
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                ) : null}
                <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
                  <ButtonLink href={`/lesson/${s.id}`} variant={s.log ? "secondary" : "primary"} size="sm" className="px-2">
                    <PenLine aria-hidden /> {s.log ? "Edit log" : "Write log"}
                  </ButtonLink>
                  <ButtonLink href={`/results?new=${s.id}`} variant="secondary" size="sm" className="px-2">
                    <FilePlus2 aria-hidden /> New test
                  </ButtonLink>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/my-progress" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-[background-color,transform] hover:bg-surface-2 active:scale-[0.99]">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
          <ClipboardList className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">My logs</span>
          <span className="block text-[13px] text-muted">Everything you've written, day by day</span>
        </span>
        <ChevronRight className="size-5 text-subtle" aria-hidden />
      </Link>
    </div>
  );
}

/** Circular progress for today's logs. */
function ProgressRing({ pct, label, done }: { pct: number; label: string; done: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-16 shrink-0" role="img" aria-label={`${label} logs written today`}>
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={done ? "var(--success)" : "var(--primary)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="ring-progress"
          style={{ "--ring-c": c } as React.CSSProperties}
        />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center text-sm font-bold">{label}</span>
    </div>
  );
}
