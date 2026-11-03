import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountActions } from "@/components/account-actions";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { Avatar, ListCard, ListRow } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate, formatDateShort, formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { getAcademy } from "@/server/modules/academy";
import { teacherProfile } from "@/server/modules/users";
import { teacherSummary } from "@/server/modules/admin";
import { teacherConsistency, teacherLogsForOffice } from "@/server/modules/teaching";
import { TeacherSummaryGrid } from "@/components/teacher-summary";
import { DayStrip, LogBody } from "@/components/teaching-log";
import Link from "next/link";

export const metadata: Metadata = { title: "Teacher" };

export default async function TeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin"]);
  const { id } = await params;
  const t = await teacherProfile(ctx, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const [academy, summary, [consistency], logs] = await Promise.all([
    getAcademy(ctx.academyId),
    teacherSummary(ctx, id),
    teacherConsistency(ctx, { count: 10, teacherId: id }),
    teacherLogsForOffice(ctx, id, 10),
  ]);

  return (
    <>
      <PageHeader title={t.name} back="/teachers" />
      <Card className="mb-5">
        <CardBody className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center">
          <Avatar name={t.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold">{t.name}</p>
              {!t.active ? <StatusBadge status="deactivated" /> : t.invited ? <StatusBadge status="invited" /> : <StatusBadge status="active" />}
            </div>
            <p className="text-sm text-muted">
              {formatPhone(t.phone)}
              {t.lastActiveAt && ` · last active ${formatRelative(t.lastActiveAt)}`}
            </p>
          </div>
          <AccountActions userId={t.id} role="teacher" name={t.name} phone={t.phone} active={t.active} academyName={academy.name} />
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader title="Last 4 weeks" description={`${summary.workingDays} working days · ${summary.subjects} subject${summary.subjects === 1 ? "" : "s"}`} />
        <CardBody className="space-y-4">
          <TeacherSummaryGrid s={summary} compact />
          {consistency && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Last 10 working days</p>
              <DayStrip showLabels days={consistency.days.map((d) => ({ date: d.date, state: d.logged >= d.expected ? "done" : d.logged ? "partial" : "missed" }))} />
            </div>
          )}
        </CardBody>
      </Card>

      <SectionTitle>Recent daily logs</SectionTitle>
      {logs.length ? (
        <ul className="mb-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          {logs.map((l) => (
            <li key={l.id}>
              <Link href={`/progress/${l.classSubjectId}`} className="block px-4 py-3 transition-colors hover:bg-surface-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">
                    {l.subjectName} <span className="font-normal text-muted">· {l.className}</span>
                  </p>
                  <span className="shrink-0 text-xs text-muted">{formatDateShort(l.date)}</span>
                </div>
                <LogBody log={l} clamp />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="mb-6">
          <CardBody className="pt-4">
            <p className="text-sm text-muted">No daily logs in the last two weeks.</p>
          </CardBody>
        </Card>
      )}

      <SectionTitle>Teaching this year</SectionTitle>
      {t.assignments.length ? (
        <ListCard>
          {t.assignments.map((a) => (
            <ListRow
              key={a.classSubjectId}
              href={`/classes/${a.classId}`}
              leading={
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                  <BookOpen className="size-5" aria-hidden />
                </span>
              }
              title={`${a.subjectName} · ${a.className}`}
              subtitle={`Since ${formatDate(a.fromDate)}`}
            />
          ))}
        </ListCard>
      ) : (
        <Card>
          <EmptyState icon={BookOpen} title="No subjects assigned" description="Assign this teacher from a class's Subjects section." />
        </Card>
      )}
    </>
  );
}
