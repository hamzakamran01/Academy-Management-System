import type { Metadata } from "next";
import Link from "next/link";
import { CoverageBar, ProgressStatus } from "@/components/progress-bits";
import { PageHeader } from "@/components/shell/page-header";
import { TeacherSummaryGrid } from "@/components/teacher-summary";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { addDays, todayPkt, weekStart } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { teacherSummary } from "@/server/modules/admin";
import { progressDashboard } from "@/server/modules/progress";

export const metadata: Metadata = { title: "My progress" };
export const dynamic = "force-dynamic";

/** T-13: the same summary the office sees (FR-TPR-12). */
export default async function MyProgressPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const ctx = await requireCtx(["teacher"]);
  const sp = await searchParams;
  const today = todayPkt();
  const period = sp.period === "week" ? "week" : "month";
  const from = period === "week" ? weekStart(today) : addDays(today, -27);
  const [summary, subjects] = await Promise.all([teacherSummary(ctx, ctx.userId, from, today), progressDashboard(ctx)]);
  return (
    <>
      <PageHeader title="My progress" subtitle={`${formatDate(from)} – ${formatDate(today)}`} back="/more" />
      <div className="mb-4 inline-flex rounded-lg border border-border bg-surface p-1">
        {(["week", "month"] as const).map((p) => (
          <Link key={p} href={`/my-progress?period=${p}`} replace className={`rounded-md px-4 py-2 text-sm font-medium ${period === p ? "bg-primary text-primary-fg" : "text-muted"}`}>
            {p === "week" ? "This week" : "Last 4 weeks"}
          </Link>
        ))}
      </div>
      <Card className="mb-5">
        <CardHeader title="Summary" description={`${summary.subjects} subjects · ${summary.workingDays} working days`} />
        <CardBody>
          <TeacherSummaryGrid s={summary} />
          <p className="mt-3 text-[13px] text-muted">These are shown separately — there's no combined score.</p>
        </CardBody>
      </Card>
      <SectionTitle>Syllabus by subject</SectionTitle>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {subjects.map((r) => (
          <li key={r.id}>
            <Link href={`/progress/${r.id}`} className="block">
              <Card className="p-4 transition-colors hover:bg-surface-2">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">{r.subjectName} · {r.className}</p>
                  <ProgressStatus p={r.progress} />
                </div>
                <CoverageBar p={r.progress} size="sm" />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
