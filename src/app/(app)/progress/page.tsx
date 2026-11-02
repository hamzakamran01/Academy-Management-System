import { BookOpen, CheckCircle2, ChevronRight, CircleAlert, NotebookPen, PenLine, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CoverageBar, ProgressStatus } from "@/components/progress-bits";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { todayPkt } from "@/lib/dates";
import { formatDate, formatRelative } from "@/lib/format";
import { isStaffAdmin } from "@/lib/roles";
import { uuidOrUndefined } from "@/lib/validation";
import { requireCtx } from "@/server/auth/session";
import { listClasses } from "@/server/modules/org";
import { progressDashboard } from "@/server/modules/progress";
import { ParentProgress } from "./parent-progress";

export const metadata: Metadata = { title: "Teaching progress" };

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ classId?: string; student?: string; status?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  if (ctx.role === "parent") return <ParentProgress ctx={ctx} studentId={uuidOrUndefined(sp.student)} />;

  const classId = uuidOrUndefined(sp.classId);
  const [rows, classes] = await Promise.all([progressDashboard(ctx, { classId }), listClasses(ctx)]);
  const filter = ["on_track", "at_risk", "behind"].includes(sp.status ?? "") ? sp.status : undefined;
  const shown = filter ? rows.filter((r) => r.progress.status === filter) : rows;
  const count = (s: string) => rows.filter((r) => r.progress.status === s).length;
  const today = todayPkt();
  const admin = isStaffAdmin(ctx.role);
  const q = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ classId, status: filter, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/progress${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title={admin ? "Teaching progress" : "My teaching"} subtitle={`${rows.length} class subject${rows.length === 1 ? "" : "s"} · syllabus covered vs expected`} />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {([
          ["on_track", "On track", "bg-success-soft text-success-fg"],
          ["at_risk", "At risk", "bg-warning-soft text-warning-fg"],
          ["behind", "Behind", "bg-danger-soft text-danger-fg"],
        ] as const).map(([s, label, cls]) => (
          <Link key={s} href={q({ status: filter === s ? undefined : s })} aria-pressed={filter === s} className={`rounded-xl px-3 py-2.5 text-center transition-shadow ${cls} ${filter === s ? "ring-2 ring-current" : ""}`}>
            <p className="tabular text-xl font-bold">{count(s)}</p>
            <p className="text-xs font-semibold">{label}</p>
          </Link>
        ))}
      </div>

      {admin && (
        <form action="/progress" className="mb-4 flex gap-2">
          <AutoSubmitSelect name="classId" defaultValue={classId ?? ""} className="h-10 w-auto min-w-40 text-sm" aria-label="Class">
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </AutoSubmitSelect>
        </form>
      )}

      {shown.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nothing to show" description={rows.length ? "No subjects match this filter." : "Assign teachers to class subjects and build their syllabus to track progress."} />
      ) : (
        <>
          <SectionTitle>{admin ? "All class subjects" : "Your subjects"}</SectionTitle>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {shown.map((r) => {
              const loggedToday = r.lastLog === today;
              return (
                <li key={r.id}>
                  <Card className="p-4">
                    <Link href={`/progress/${r.id}`} className="group block">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{r.subjectName} · {r.className}</p>
                          <p className="truncate text-[13px] text-muted">{r.teacherName ?? "No teacher"}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <ProgressStatus p={r.progress} />
                          <ChevronRight className="size-5 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </div>
                      </div>
                      <div className="mt-3">
                        <CoverageBar p={r.progress} size="sm" />
                      </div>
                    </Link>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[13px]">
                      {r.planStatus === "submitted" ? (
                        <Badge tone="success" icon={CheckCircle2}>Plan submitted</Badge>
                      ) : r.planStatus === "draft" ? (
                        <Badge tone="warning" icon={CircleAlert}>Plan draft</Badge>
                      ) : (
                        <Badge tone="danger" icon={XCircle}>No plan this week</Badge>
                      )}
                      <span className="text-muted">
                        Last log: {r.lastLog ? (loggedToday ? "today" : formatRelative(`${r.lastLog}T12:00:00+05:00`)) : "never"}
                      </span>
                      {ctx.role === "teacher" && (
                        <div className="ms-auto flex gap-1.5">
                          <ButtonLink href={`/plans/${r.id}`} variant="ghost" size="sm">
                            <NotebookPen aria-hidden /> Plan
                          </ButtonLink>
                          <ButtonLink href={`/lesson/${r.id}`} variant={loggedToday ? "secondary" : "soft"} size="sm">
                            <PenLine aria-hidden /> {loggedToday ? "Edit log" : "Log lesson"}
                          </ButtonLink>
                        </div>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-center text-[13px] text-muted">The thin mark on each bar is where the class should be by {formatDate(today)}.</p>
        </>
      )}
    </>
  );
}
