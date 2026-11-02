import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { addDays, isValidISODate, todayPkt, weekStart } from "@/lib/dates";
import { formatDate, formatDateTime, formatPercent } from "@/lib/format";
import { ListTodo } from "lucide-react";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { getWeeklyPlan, sameSubjectTargets } from "@/server/modules/progress";
import { teacherClassSubjectIds } from "@/server/policy/scope";
import { PlanEditor } from "./plan-editor";

export const metadata: Metadata = { title: "Weekly plan" };

/** T-05 / FR-TPR-03/04 */
export default async function PlanPage({ params, searchParams }: { params: Promise<{ csId: string }>; searchParams: Promise<{ week?: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const [{ csId }, sp] = await Promise.all([params, searchParams]);
  const thisWeek = weekStart(todayPkt());
  const week = sp.week && isValidISODate(sp.week) ? weekStart(sp.week) : thisWeek;
  const data = await getWeeklyPlan(ctx, csId, week).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });
  const mine = ctx.role === "teacher" ? new Set(await teacherClassSubjectIds(ctx.userId, ctx.academyId)) : null;
  const targets = (await sameSubjectTargets(ctx, csId)).filter((t) => !mine || mine.has(t.id));
  const late = data.plan ? data.plan.isLate : new Date() > data.deadline;
  const hasSyllabus = data.tree.some((b) => b.chapters.some((c) => c.topics.length));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Weekly plan" subtitle={`${data.info.subjectName} · ${data.info.className}`} back={`/progress/${csId}`} />

      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-1.5 shadow-xs">
        <Link href={`/plans/${csId}?week=${addDays(week, -7)}`} replace className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-surface-2" aria-label="Previous week">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold">{week === thisWeek ? "This week" : week > thisWeek ? "Next week" : "Week of"}</p>
          <p className="text-xs text-muted">{formatDate(week)} – {formatDate(addDays(week, 5))}</p>
        </div>
        <Link href={`/plans/${csId}?week=${addDays(week, 7)}`} replace className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-surface-2" aria-label="Next week">
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {data.plan?.status === "submitted" ? <StatusBadge status="submitted" /> : data.plan ? <StatusBadge status="draft" /> : <StatusBadge status="missing" label="Not started" />}
          {late && <StatusBadge status="late_plan" />}
          <span className="text-[13px] text-muted">
            {data.plan?.submittedAt ? `Submitted ${formatDateTime(data.plan.submittedAt)}` : `Due ${formatDateTime(data.deadline)}`}
          </span>
        </div>
        {data.completion != null && (
          <div className="mt-3">
            <ProgressBar value={data.completion} tone="success" size="sm" label="Plan completed" />
            <p className="mt-1 text-[13px] text-muted">
              <span className="tabular font-semibold text-fg">{formatPercent(data.completion, 0)}</span> of planned topics completed
            </p>
          </div>
        )}
      </Card>

      {!hasSyllabus ? (
        <EmptyState icon={ListTodo} title="No syllabus yet" description="Plans are made from syllabus topics. Ask the office to add them." />
      ) : (
        <PlanEditor
          key={week}
          csId={csId}
          week={week}
          planId={data.plan?.id ?? null}
          submitted={data.plan?.status === "submitted"}
          initialTopics={data.plan?.topicIds ?? []}
          initialNote={data.plan?.note ?? ""}
          carryForward={data.carryForward}
          tree={data.tree}
          canEdit={ctx.role === "teacher" || data.canEdit}
          canComment={data.canComment}
          comments={data.comments.map((c) => ({ ...c, at: c.at.toISOString() }))}
          copyTargets={targets}
        />
      )}
    </div>
  );
}
