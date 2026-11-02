import { CheckCircle2, ClipboardList, FilePlus2, GraduationCap, NotebookPen, PenLine, Wallet } from "lucide-react";
import Link from "next/link";
import { ProgressStatus } from "@/components/progress-bits";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, SectionTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/data";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { formatDate, formatPercent } from "@/lib/format";
import type { teacherDashboard } from "@/server/modules/dashboards";

type D = Awaited<ReturnType<typeof teacherDashboard>>;

/** PRD §4.2 Teacher "Today": classes with quick actions, pending items, syllabus status. */
export function TeacherHome({ d }: { d: D }) {
  const { plansDue, logsMissing, drafts } = d.pending;
  if (!d.subjects.length) return <EmptyState icon={ClipboardList} title="No subjects assigned yet" description="Ask the office to assign you to class subjects." />;
  return (
    <div className="space-y-5">
      {(plansDue.length > 0 || drafts.length > 0) && (
        <div className="space-y-2">
          {plansDue.length > 0 && (
            <Notice tone="warning" icon={ClipboardList} title={`${plansDue.length} weekly plan${plansDue.length === 1 ? "" : "s"} to submit`}>
              <Link href="/plans" className="font-semibold underline">Open weekly plans</Link>
            </Notice>
          )}
          {drafts.length > 0 && (
            <Notice tone="info" icon={GraduationCap} title={`${drafts.length} test${drafts.length === 1 ? "" : "s"} not published`}>
              {drafts.slice(0, 3).map((t) => (
                <Link key={t.id} href={`/results/${t.id}`} className="block underline">
                  {t.subjectName} · {t.className} — {t.title} ({formatDate(t.date).slice(0, 6)})
                </Link>
              ))}
            </Notice>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <SectionTitle className="pb-0">Today</SectionTitle>
        <span className="text-[13px] text-muted">{logsMissing.length ? `${logsMissing.length} lesson${logsMissing.length === 1 ? "" : "s"} to log` : "All lessons logged ✓"}</span>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {d.subjects.map((s) => (
          <li key={s.id}>
            <Card className="p-4">
              <Link href={`/progress/${s.id}`} className="block">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.subjectName}</p>
                    <p className="truncate text-[13px] text-muted">{s.className}</p>
                  </div>
                  {s.progress && <ProgressStatus p={s.progress} />}
                </div>
                {s.progress?.coverage != null && (
                  <div className="mt-3">
                    <ProgressBar value={s.progress.coverage} marker={s.progress.expected} size="sm" label="Syllabus covered" />
                    <p className="mt-1 text-xs text-muted">
                      {formatPercent(s.progress.coverage, 0)} covered{s.progress.expected != null ? ` · expected ${formatPercent(s.progress.expected, 0)}` : ""}
                    </p>
                  </div>
                )}
              </Link>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <ButtonLink href={`/lesson/${s.id}`} variant={s.loggedToday ? "secondary" : "primary"} size="sm" className="px-2">
                  {s.loggedToday ? <CheckCircle2 aria-hidden /> : <PenLine aria-hidden />} {s.loggedToday ? "Logged" : "Log"}
                </ButtonLink>
                <ButtonLink href={`/results?new=${s.id}`} variant="secondary" size="sm" className="px-2">
                  <FilePlus2 aria-hidden /> Test
                </ButtonLink>
                <ButtonLink href={`/fees/class/${s.classId}`} variant="secondary" size="sm" className="px-2">
                  <Wallet aria-hidden /> Fees
                </ButtonLink>
              </div>
              {s.planStatus !== "submitted" && (
                <Link href={`/plans/${s.id}`} className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-warning-fg">
                  <NotebookPen className="size-4" aria-hidden /> Weekly plan {s.planStatus === "draft" ? "is a draft" : "not started"}
                </Link>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <Card>
        <CardBody className="flex items-center justify-between gap-3 pt-4">
          <div>
            <p className="font-medium">Your progress summary</p>
            <p className="text-[13px] text-muted">Logs, plans on time and tests published</p>
          </div>
          <ButtonLink href="/my-progress" variant="soft" size="sm">View</ButtonLink>
        </CardBody>
      </Card>

    </div>
  );
}
