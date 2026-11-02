import { GraduationCap } from "lucide-react";
import { ChildSwitcher } from "@/components/child-switcher";
import { Sparkline } from "@/components/charts/sparkline";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatDate, formatPercent } from "@/lib/format";
import { fmtMark } from "@/lib/grades";
import type { Ctx } from "@/server/auth/session";
import { studentResults, TYPE_LABEL } from "@/server/modules/results";
import { myChildren } from "@/server/modules/students";

/** P-03: results by subject, test detail and subject trend. */
export async function ParentResults({ ctx, studentId, highlight }: { ctx: Ctx; studentId?: string; highlight?: string }) {
  const kids = await myChildren(ctx);
  if (!kids.length) return <EmptyState icon={GraduationCap} title="No children linked" description="Contact the academy office." />;
  const child = kids.find((k) => k.id === studentId) ?? kids[0]!;
  const r = await studentResults(ctx, child.id);

  return (
    <>
      <PageHeader title="Results" subtitle={`${child.name} · ${child.className ?? ""}`} bell />
      <ChildSwitcher kids={kids} active={child.id} basePath="/results" />

      {r.items.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No results yet" description="Published test results appear here as soon as teachers publish them." />
      ) : (
        <>
          <Card className="mb-5 bg-[linear-gradient(135deg,var(--primary-soft),var(--surface)_70%)]">
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm text-muted">Overall average this year</p>
                <p className="tabular text-3xl font-bold tracking-tight">{formatPercent(r.overall)}</p>
              </div>
              {r.overallGrade && <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-fg">{r.overallGrade}</span>}
            </div>
          </Card>

          <SectionTitle>By subject</SectionTitle>
          <ul className="mb-6 grid gap-3 sm:grid-cols-2">
            {r.subjects.map((s) => (
              <li key={s.subjectName}>
                <Card className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.subjectName}</p>
                    <p className="text-[13px] text-muted">
                      {s.count} test{s.count === 1 ? "" : "s"} · avg <span className="tabular font-semibold text-fg">{formatPercent(s.average)}</span>
                    </p>
                  </div>
                  <Sparkline points={s.trend.map((t) => t.pct)} />
                  {s.grade && <Badge tone="primary" size="md">{s.grade}</Badge>}
                </Card>
              </li>
            ))}
          </ul>

          <Card>
            <CardHeader title="Recent tests" />
            <ul className="divide-y divide-border border-t border-border">
              {r.items.map((t) => (
                <li key={t.assessmentId} className={cn("px-4 py-3", highlight === t.assessmentId && "bg-primary-soft/40")}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {t.subjectName} · {t.title}
                      </p>
                      <p className="text-[13px] text-muted">
                        {TYPE_LABEL[t.type]} · {formatDate(t.date)}
                        {t.classAverage != null && <> · class avg {fmtMark(t.classAverage)}</>}
                        {t.position != null && <> · position {t.position} of {t.outOf}</>}
                      </p>
                      {t.corrected && <Badge tone="info" className="mt-1">Corrected</Badge>}
                    </div>
                    <div className="text-end">
                      {t.absent ? (
                        <Badge>Absent</Badge>
                      ) : (
                        <>
                          <p className="tabular text-lg font-bold leading-6">
                            {fmtMark(t.value!)}
                            <span className="text-sm font-normal text-muted">/{fmtMark(t.totalMarks)}</span>
                          </p>
                          <p className="tabular text-[13px] text-muted">
                            {t.pct}% · <span className="font-semibold text-fg">{t.grade}</span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
