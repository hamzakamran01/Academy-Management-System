import { CheckCircle2, ChevronRight, CircleDashed, ClipboardList, FilePlus2, Flame, GraduationCap, PenLine } from "lucide-react";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { DayStrip, LogBody, LogPill } from "@/components/teaching-log";
import { ButtonLink } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/data";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { classBadge } from "@/lib/format";
import type { teacherDashboard } from "@/server/modules/dashboards";

type D = Awaited<ReturnType<typeof teacherDashboard>>;
type Item = D["log"]["items"][number];
export type TeacherClass = { id: string; name: string; items: Item[]; done: number; total: number };

/** The teacher's subjects grouped by class, in the order the office set up the classes. */
export function teacherClasses(items: Item[]): TeacherClass[] {
  const map = new Map<string, TeacherClass>();
  for (const it of items) {
    const c = map.get(it.classId) ?? { id: it.classId, name: it.className, items: [], done: 0, total: 0 };
    c.items.push(it);
    c.total++;
    if (it.log) c.done++;
    map.set(it.classId, c);
  }
  return [...map.values()];
}

/**
 * Teacher "Today" in two steps:
 *  1. Choose a class — one aligned tile per class with today's log status.
 *  2. Inside a class — class tabs to switch, then write the log or start a test per subject.
 */
export function TeacherHome({ d, classId }: { d: D; classId?: string }) {
  const { log, drafts } = d;
  if (!log.items.length) return <EmptyState icon={ClipboardList} title="No classes assigned yet" description="Ask the office to assign you to class subjects." />;
  const classes = teacherClasses(log.items);
  const active = classes.find((c) => c.id === classId);
  return active ? <ClassScreen d={d} classes={classes} active={active} /> : <ClassMenu d={d} classes={classes} drafts={drafts} />;
}

// ─── Step 1: class menu ─────────────────────────────────────────────────────
function ClassMenu({ d, classes, drafts }: { d: D; classes: TeacherClass[]; drafts: D["drafts"] }) {
  const { log } = d;
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

      <DraftsNotice drafts={drafts} />

      <section aria-labelledby="classes-title">
        <SectionTitle>
          <span id="classes-title">Choose a class</span>
        </SectionTitle>
        <ul className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => {
            const complete = c.done === c.total;
            return (
              <li key={c.id}>
                <Link
                  href={`/home?class=${c.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-4 shadow-card transition-[background-color,transform,box-shadow] hover:bg-surface-2 hover:shadow-raised active:scale-[0.985]"
                >
                  <div className="mb-4 flex items-center gap-3.5">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-base font-bold text-primary-soft-fg">
                      {classBadge(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{c.name}</span>
                      <span className="block truncate text-[13px] text-muted">{c.items.map((i) => i.subjectName).join(" · ")}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  <div className="mt-auto flex items-center gap-3 border-t border-border pt-3">
                    {log.isWorkingDay ? (
                      <>
                        <ProgressBar value={(c.done / c.total) * 100} size="sm" tone={complete ? "success" : "primary"} label={`${c.name}: ${c.done} of ${c.total} logs written`} className="flex-1" />
                        <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-semibold", complete ? "text-success-fg" : "text-muted")}>
                          {complete ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleDashed className="size-3.5" aria-hidden />}
                          <span className="tabular">
                            {c.done}/{c.total}
                          </span>{" "}
                          logged
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted">
                        {c.total} subject{c.total === 1 ? "" : "s"} · no class today
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <MyLogsLink />
    </div>
  );
}

// ─── Step 2: one class ──────────────────────────────────────────────────────
function ClassScreen({ d, classes, active }: { d: D; classes: TeacherClass[]; active: TeacherClass }) {
  const { log } = d;
  const drafts = d.drafts.filter((t) => t.classId === active.id);
  return (
    <div className="space-y-5">
      {classes.length > 1 && (
        <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0" aria-label="Switch class">
          {classes.map((c) => {
            const on = c.id === active.id;
            const complete = c.done === c.total;
            return (
              <Link
                key={c.id}
                href={`/home?class=${c.id}`}
                replace
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-[background-color,transform] active:scale-95",
                  on ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg hover:bg-surface-2",
                )}
              >
                {log.isWorkingDay && (
                  <span
                    className={cn("size-2 rounded-full", complete ? "bg-success" : "bg-warning", on && "ring-2 ring-primary-fg/70")}
                    aria-label={complete ? "all logged" : "logs to write"}
                  />
                )}
                {c.name}
              </Link>
            );
          })}
        </nav>
      )}

      <DraftsNotice drafts={drafts} hideClass />

      <section aria-labelledby="subjects-title">
        <SectionTitle
          action={
            log.isWorkingDay ? (
              <span className="tabular text-xs font-semibold text-muted">
                {active.done}/{active.total} logged
              </span>
            ) : undefined
          }
        >
          <span id="subjects-title">Your subjects</span>
        </SectionTitle>
        <ul className="stagger grid grid-cols-1 gap-3 md:grid-cols-2">
          {active.items.map((s) => (
            <li key={s.id}>
              <Card className={cn("flex h-full flex-col p-4", !s.log && log.isWorkingDay && "border-primary/30")}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-base font-semibold">{s.subjectName}</p>
                  <LogPill logged={!!s.log} />
                </div>
                {s.log ? (
                  <Link href={`/lesson/${s.id}`} className="group mt-3 flex items-start gap-2 rounded-lg bg-surface-2 p-3 transition-colors hover:bg-surface-3">
                    <LogBody log={s.log} clamp className="flex-1" />
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                ) : (
                  <p className="mt-1 text-[13px] text-muted">{log.isWorkingDay ? "Write what you taught today and any homework." : "No class today — you can still write a log."}</p>
                )}
                <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                  <ButtonLink href={`/lesson/${s.id}`} variant={s.log ? "secondary" : "primary"} className="px-2">
                    <PenLine aria-hidden /> {s.log ? "Edit log" : "Write log"}
                  </ButtonLink>
                  <ButtonLink href={`/results?new=${s.id}`} variant="secondary" className="px-2">
                    <FilePlus2 aria-hidden /> New test
                  </ButtonLink>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <MyLogsLink />
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────
function DraftsNotice({ drafts, hideClass = false }: { drafts: D["drafts"]; hideClass?: boolean }) {
  if (!drafts.length) return null;
  return (
    <Notice tone="info" icon={GraduationCap} title={`${drafts.length} test${drafts.length === 1 ? "" : "s"} waiting for marks`}>
      {drafts.slice(0, 3).map((t) => (
        <Link key={t.id} href={`/results/${t.id}`} className="block font-medium underline underline-offset-2">
          {t.subjectName}
          {hideClass ? "" : ` · ${t.className}`} — {t.title}
        </Link>
      ))}
    </Notice>
  );
}

function MyLogsLink() {
  return (
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
