import { ClipboardList, PenLine } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { LogBody } from "@/components/teaching-log";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { todayPkt } from "@/lib/dates";
import { formatDate, formatDateShort } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { classSubjectHistory } from "@/server/modules/teaching";

export const metadata: Metadata = { title: "Subject log" };

/** Day-by-day log for one class subject (last ~6 weeks). */
export default async function SubjectLogPage({ params }: { params: Promise<{ csId: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const { csId } = await params;
  const data = await classSubjectHistory(ctx, csId).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });
  const today = todayPkt();
  const { info, logs } = data;

  return (
    <>
      <PageHeader
        title={`${info.subjectName} · ${info.className}`}
        subtitle={info.teacherName ? `Taught by ${info.teacherName}` : "No teacher assigned"}
        back={ctx.role === "teacher" ? "/my-progress" : "/progress"}
        actions={
          <ButtonLink href={`/lesson/${csId}`} size="sm" variant={ctx.role === "teacher" ? "primary" : "secondary"}>
            <PenLine aria-hidden /> {ctx.role === "teacher" ? "Write log" : "Add / fix log"}
          </ButtonLink>
        }
      />
      {logs.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No logs yet" description="Daily logs written for this subject appear here." />
      ) : (
        <ol className="stagger relative space-y-3 border-s-2 border-border ps-5 sm:ms-2">
          {logs.map((l) => (
            <li key={l.id} className="relative">
              <span className={`absolute -start-[27px] top-4 size-3 rounded-full ring-4 ring-bg ${l.noClassReason ? "bg-subtle" : "bg-primary"}`} aria-hidden />
              <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{l.date === today ? "Today" : formatDateShort(l.date)}</p>
                  <p className="text-xs text-muted">{formatDate(l.date)}</p>
                </div>
                <LogBody log={l} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
