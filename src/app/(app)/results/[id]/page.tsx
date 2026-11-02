import { Award, CheckCircle2, LockOpen, TrendingDown, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/data";
import { Notice } from "@/components/ui/feedback";
import { formatDate, formatDateTime } from "@/lib/format";
import { fmtMark, gradeFor, percentage } from "@/lib/grades";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { getSettings } from "@/server/modules/academy";
import { getMarksSheet, TYPE_LABEL } from "@/server/modules/results";
import { MarksEntry } from "./marks-entry";
import { DeleteDraftButton, RequestCorrectionButton, UnlockButton } from "./result-actions";

export const metadata: Metadata = { title: "Test" };

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const { id } = await params;
  const t = await getMarksSheet(ctx, id).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });
  const settings = await getSettings(ctx.academyId);

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={`${t.subjectName} · ${t.className} · ${TYPE_LABEL[t.type]} · ${formatDate(t.date)}`}
        back="/results"
        actions={
          <div className="flex items-center gap-1.5">
            {t.can.unlock && <UnlockButton id={t.id} />}
            {t.can.requestCorrection && <RequestCorrectionButton id={t.id} requested={!!t.correctionRequestedAt} />}
            {t.can.delete && <DeleteDraftButton id={t.id} />}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={t.status} size="md" />
        <Badge size="md">Total {fmtMark(t.totalMarks)}</Badge>
        {t.teacherName && <Badge size="md">{t.teacherName}</Badge>}
        {t.correctedAt && <Badge tone="info" size="md">Corrected {formatDate(t.correctedAt.toISOString().slice(0, 10))}</Badge>}
      </div>

      {t.status === "unlocked" && (
        <Notice tone="warning" icon={LockOpen} className="mb-4" title="Unlocked for correction">
          {t.unlockReason} — edit the marks and publish again. Parents whose child's marks change will see “Corrected”.
        </Notice>
      )}
      {t.correctionRequestedAt && t.status === "published" && ctx.role !== "teacher" && (
        <Notice tone="info" className="mb-4" title={`Correction requested ${formatDateTime(t.correctionRequestedAt)}`}>
          {t.correctionRequestNote ?? "The teacher asked for this test to be unlocked."}
        </Notice>
      )}

      {t.can.edit ? (
        <MarksEntry
          testId={t.id}
          total={t.totalMarks}
          passPercent={t.passPercent}
          rows={t.rows.map((r) => ({ studentId: r.studentId, name: r.name, rollNo: r.rollNo, value: r.value, isAbsent: r.isAbsent }))}
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Class average" value={t.stats.average != null ? fmtMark(t.stats.average) : "—"} sub={t.stats.average != null ? `${percentage(t.stats.average, t.totalMarks)}%` : undefined} icon={Award} />
            <StatTile label="Highest" value={t.stats.highest != null ? fmtMark(t.stats.highest) : "—"} icon={TrendingUp} tone="success" />
            <StatTile label="Lowest" value={t.stats.lowest != null ? fmtMark(t.stats.lowest) : "—"} icon={TrendingDown} tone="warning" />
            <StatTile label="Passed" value={`${t.stats.passed}/${t.stats.appeared}`} sub={`Pass mark ${t.passPercent}% · ${t.stats.absent} absent`} icon={Users} tone="info" />
          </div>
          <Card>
            <ul className="divide-y divide-border">
              {t.rows.map((r) => {
                const pct = !r.isAbsent && r.value != null ? percentage(r.value, t.totalMarks) : null;
                const fail = pct != null && pct < t.passPercent;
                return (
                  <li key={r.studentId} className="flex items-center gap-3 px-4 py-3">
                    <span className="tabular w-7 text-center text-sm font-semibold text-muted">{r.rollNo}</span>
                    <p className="min-w-0 flex-1 truncate font-medium">{r.name}</p>
                    {r.isAbsent ? (
                      <Badge>Absent</Badge>
                    ) : r.value != null ? (
                      <>
                        <span className="tabular text-sm text-muted">{pct}%</span>
                        <Badge tone={fail ? "danger" : pct! >= 80 ? "success" : "primary"}>{gradeFor(pct!, settings.gradeScale)}</Badge>
                        <span className="tabular w-16 text-end font-semibold">
                          {fmtMark(r.value)}
                          <span className="text-xs font-normal text-muted">/{fmtMark(t.totalMarks)}</span>
                        </span>
                      </>
                    ) : (
                      <Badge tone="warning">No marks</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          {t.publishedAt && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-muted">
              <CheckCircle2 className="size-4 text-success" aria-hidden /> Published {formatDateTime(t.publishedAt)} · visible to parents
            </p>
          )}
        </>
      )}
    </>
  );
}
