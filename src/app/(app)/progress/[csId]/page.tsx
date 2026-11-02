import { CalendarClock, Gauge, ListTodo, NotebookPen, PenLine, Pencil, Target } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoverageBar, ProgressStatus, TopicStatusIcon } from "@/components/progress-bits";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatTile } from "@/components/ui/data";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { formatDate, formatDateShort, formatPercent } from "@/lib/format";
import { isStaffAdmin } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { getSettings } from "@/server/modules/academy";
import { classSubjectProgress, recentLogs } from "@/server/modules/progress";

export const metadata: Metadata = { title: "Subject progress" };

const NO_LESSON: Record<string, string> = { test: "Test", revision: "Revision", teacher_absent: "Teacher absent", event: "Event", other: "Other" };

/** T-07 / FR-TPR-09: progress per class-subject. */
export default async function SubjectProgressPage({ params }: { params: Promise<{ csId: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const { csId } = await params;
  const data = await classSubjectProgress(ctx, csId).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });
  const [logs, settings] = await Promise.all([recentLogs(ctx, csId, 8), getSettings(ctx.academyId)]);
  const { info, progress: p, tree } = data;
  const admin = isStaffAdmin(ctx.role);
  const canEditSyllabus = admin || (ctx.role === "teacher" && settings.teacherCanEditSyllabus);

  return (
    <>
      <PageHeader
        title={`${info.subjectName} · ${info.className}`}
        subtitle={info.teacherName ?? "No teacher assigned"}
        back="/progress"
        actions={canEditSyllabus && (
          <ButtonLink href={`/syllabus/${csId}`} variant="secondary" size="sm">
            <Pencil aria-hidden /> <span className="hidden sm:inline">Syllabus</span>
          </ButtonLink>
        )}
      />

      {p.status === "no_syllabus" ? (
        <EmptyState
          icon={ListTodo}
          title="No syllabus yet"
          description={canEditSyllabus ? "Add the book, chapters and topics so progress can be tracked." : "The office adds the syllabus (book → chapter → topic)."}
          action={canEditSyllabus && <ButtonLink href={`/syllabus/${csId}`}>Build syllabus</ButtonLink>}
        />
      ) : (
        <>
          <Card className="mb-4">
            <CardBody className="pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted">Syllabus covered</p>
                <ProgressStatus p={p} />
              </div>
              <CoverageBar p={p} />
              {p.difference != null && (
                <p className="mt-2 text-[13px] text-muted">
                  {p.difference >= 0 ? (
                    <>
                      <span className="font-semibold text-success-fg">{formatPercent(p.difference)} ahead</span> of plan
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-danger-fg">{formatPercent(-p.difference)} behind</span> where the class should be today
                    </>
                  )}
                </p>
              )}
              {ctx.role === "teacher" && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <ButtonLink href={`/lesson/${csId}`} block>
                    <PenLine aria-hidden /> Log lesson
                  </ButtonLink>
                  <ButtonLink href={`/plans/${csId}`} variant="secondary" block>
                    <NotebookPen aria-hidden /> Weekly plan
                  </ButtonLink>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Remaining" value={`${p.remainingTopics} topics`} sub={`${p.remainingSize} periods`} icon={ListTodo} />
            <StatTile label="Done this week" value={data.completedThisWeek} sub="topics completed" icon={Target} tone="success" />
            <StatTile label="Pace" value={p.speed > 0 ? `${p.speed}` : "—"} sub="periods / working day" icon={Gauge} tone="info" />
            <StatTile
              label="Projected finish"
              value={p.projectedFinish ? formatDate(p.projectedFinish).slice(0, 6) : "—"}
              sub={p.projectedFinish ? formatDate(p.projectedFinish).slice(7) : "Not enough recent progress"}
              icon={CalendarClock}
              tone="warning"
            />
          </div>

          {data.upcomingTargets.length > 0 && (
            <Notice tone="info" icon={Target} className="mb-4" title="Upcoming chapter targets">
              {data.upcomingTargets.map((t) => `${t.title} — ${formatDate(t.targetDate)}`).join(" · ")}
            </Notice>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader title="Chapters" description={`${p.completedTopics}/${p.totalTopics} topics · ${p.completedSize}/${p.totalSize} periods`} />
              <div className="border-t border-border">
                {tree.map((b) => (
                  <div key={b.id}>
                    {tree.length > 1 && <p className="bg-surface-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">{b.title}</p>}
                    {b.chapters.map((c) => {
                      const done = c.topics.filter((t) => t.status === "completed").length;
                      const status = done === c.topics.length && c.topics.length ? "completed" : done > 0 || c.topics.some((t) => t.status === "started") ? "started" : "not_started";
                      return (
                        <details key={c.id} className="group border-b border-border last:border-b-0" open={status === "started"}>
                          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-surface-2">
                            <TopicStatusIcon status={status} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{c.title}</p>
                              <p className="text-[13px] text-muted">
                                {done}/{c.topics.length} topics{c.targetDate ? ` · target ${formatDate(c.targetDate)}` : ""}
                              </p>
                            </div>
                          </summary>
                          <ul className="pb-2 ps-12 pe-4">
                            {c.topics.map((t) => (
                              <li key={t.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                                <TopicStatusIcon status={t.status} className="size-4" />
                                <span className="min-w-0 flex-1">{t.title}</span>
                                {t.size > 1 && <Badge>{t.size} periods</Badge>}
                                {t.completedOn && <span className="text-xs text-muted">{formatDateShort(t.completedOn).split(",")[1]}</span>}
                              </li>
                            ))}
                          </ul>
                        </details>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Recent lessons" />
              {logs.length ? (
                <ul className="divide-y divide-border border-t border-border">
                  {logs.map((l) => (
                    <li key={l.id} className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-muted">{formatDateShort(l.date)}</p>
                      {l.noLessonReason ? (
                        <p className="text-sm">No lesson — {NO_LESSON[l.noLessonReason]}{l.note ? `: ${l.note}` : ""}</p>
                      ) : (
                        <ul className="mt-1 space-y-0.5">
                          {l.topics.map((t, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <TopicStatusIcon status={t.status} className="size-4" />
                              {t.title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={PenLine} title="No lessons logged yet" className="py-8" />
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
