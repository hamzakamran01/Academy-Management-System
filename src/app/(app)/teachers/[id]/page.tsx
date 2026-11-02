import { BookOpen, Crown } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountActions } from "@/components/account-actions";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { Avatar, ListCard, ListRow } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate, formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { getAcademy } from "@/server/modules/academy";
import { teacherProfile } from "@/server/modules/users";

export const metadata: Metadata = { title: "Teacher" };

export default async function TeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin"]);
  const { id } = await params;
  const t = await teacherProfile(ctx, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const academy = await getAcademy(ctx.academyId);

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

      {t.classTeacherOf.length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Class teacher of" description="Marks daily attendance for these classes" />
          <CardBody className="flex flex-wrap gap-2">
            {t.classTeacherOf.map((c) => (
              <Badge key={c.id} tone="primary" size="md" icon={Crown}>{c.name}</Badge>
            ))}
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
