import { BookOpen, CalendarClock, CheckCircle2, CircleDot, NotebookPen } from "lucide-react";
import { ChildSwitcher } from "@/components/child-switcher";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { todayPkt } from "@/lib/dates";
import { formatDate, formatDateShort, formatPercent } from "@/lib/format";
import type { Ctx } from "@/server/auth/session";
import { parentProgress } from "@/server/modules/progress";
import { myChildren } from "@/server/modules/students";

/** P-04: per subject — this week's topics, homework, % covered, chapters done (FR-TPR-10). */
export async function ParentProgress({ ctx, studentId }: { ctx: Ctx; studentId?: string }) {
  const kids = await myChildren(ctx);
  if (!kids.length) return <EmptyState icon={BookOpen} title="No children linked" />;
  const child = kids.find((k) => k.id === studentId) ?? kids[0]!;
  const data = await parentProgress(ctx, child.id);
  const today = todayPkt();

  return (
    <>
      <PageHeader title="Progress" subtitle={`What ${child.name.split(" ")[0]} learned this week`} bell />
      <ChildSwitcher kids={kids} active={child.id} basePath="/progress" />
      {data.subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects yet" />
      ) : (
        <ul className="space-y-3">
          {data.subjects.map((s) => (
            <li key={s.classSubjectId}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold">{s.subjectName}</p>
                    <p className="text-[13px] text-muted">{s.teacherName ?? ""}</p>
                  </div>
                  {s.status && s.status !== "no_syllabus" && <StatusBadge status={s.status} />}
                </div>

                {s.coverage != null ? (
                  <div className="mt-3">
                    <ProgressBar value={s.coverage} label={`${s.subjectName} syllabus covered`} />
                    <p className="mt-1.5 text-[13px] text-muted">
                      <span className="tabular font-semibold text-fg">{formatPercent(s.coverage, 0)}</span> of syllabus covered · {s.completedChapters.length}/{s.totalChapters} chapters done
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] text-muted">Syllabus not added yet.</p>
                )}

                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">This week</p>
                  {s.thisWeek.length ? (
                    <ul className="space-y-1.5">
                      {s.thisWeek.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          {t.status === "completed" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Completed" /> : <CircleDot className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Started" />}
                          <span className="min-w-0 flex-1">{t.title}</span>
                          <span className="shrink-0 text-xs text-muted">{formatDateShort(t.date).split(",")[0]}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">No lessons logged yet this week.</p>
                  )}
                </div>

                {s.homework.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {s.homework.map((h) => (
                      <div key={h.id} className="flex items-start gap-3 rounded-xl bg-info-soft p-3 text-info-fg">
                        <NotebookPen className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-semibold">{h.title}</p>
                          {h.details && <p className="opacity-90">{h.details}</p>}
                        </div>
                        <Badge tone={h.dueDate <= today ? "warning" : "info"} icon={CalendarClock}>
                          {h.dueDate === today ? "Due today" : `Due ${formatDate(h.dueDate).slice(0, 6)}`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
