import { BookOpen, ClipboardList, Crown, GraduationCap, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { formatMoney } from "@/lib/format";
import { isStaffAdmin } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { getClassDetail, listSubjects } from "@/server/modules/org";
import { teacherOptions } from "@/server/modules/users";
import { AddSubjectButton, EditClassButton, RemoveClassButton, SubjectRowMenu, TeacherPicker } from "./class-admin";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const { id } = await params;
  const cls = await getClassDetail(ctx, id).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });
  const admin = isStaffAdmin(ctx.role);
  const [teachers, allSubjects] = admin
    ? await Promise.all([teacherOptions(ctx.academyId), listSubjects(ctx.academyId)])
    : [[], []];
  const taken = new Set(cls.subjects.map((s) => s.subjectId));
  const available = allSubjects.filter((s) => !taken.has(s.id)).map((s) => ({ id: s.id, name: s.name }));
  const studentCount = cls.studentCount;
  const isClassTeacher = cls.classTeacherId === ctx.userId;

  const quick = [
    { href: `/students?classId=${id}`, label: "Students", icon: Users, show: true },
    { href: `/results?classId=${id}`, label: "Results", icon: GraduationCap, show: true },
    { href: `/fees/class/${id}`, label: "Fees", icon: Wallet, show: true },
    { href: `/progress?classId=${id}`, label: "Progress", icon: ClipboardList, show: true },
  ].filter((q) => q.show);

  return (
    <>
      <PageHeader
        title={cls.name}
        subtitle={[cls.shift, cls.classTeacherName && `Class teacher: ${cls.classTeacherName}`].filter(Boolean).join(" · ") || undefined}
        back="/classes"
        actions={
          admin && (
            <EditClassButton
              teachers={teachers}
              values={{ id: cls.id, name: cls.name, level: cls.level, shift: cls.shift, capacity: cls.capacity, classTeacherId: cls.classTeacherId }}
            />
          )
        }
      />

      {isClassTeacher && (
        <Badge tone="primary" size="md" icon={Crown} className="mb-4">You are the class teacher</Badge>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Students" value={studentCount} sub={cls.capacity ? `of ${cls.capacity} seats` : undefined} icon={Users} />
        <StatTile label="Subjects" value={cls.subjects.length} icon={BookOpen} tone="info" />
        {cls.monthlyFee !== undefined && (
          <StatTile label="Monthly fee" value={cls.monthlyFee != null ? formatMoney(cls.monthlyFee) : "Not set"} icon={Wallet} tone="success" href={ctx.role === "super_admin" ? "/fees/settings" : undefined} />
        )}
      </div>

      <nav className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Class sections">
        {quick.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium shadow-xs hover:bg-surface-2"
          >
            <Icon className="size-4 text-primary" aria-hidden /> {label}
          </Link>
        ))}
      </nav>

      <Card className="mb-6">
        <CardHeader
          title="Subjects & teachers"
          description={admin ? "One teacher per subject. Changing a teacher keeps history." : undefined}
          action={admin && <AddSubjectButton classId={id} subjects={available} teachers={teachers} />}
        />
        {cls.subjects.length === 0 ? (
          <EmptyState icon={BookOpen} title="No subjects yet" description={admin ? "Add the subjects taught in this class." : undefined} className="py-8" />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {cls.subjects.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {s.subjectName}
                    {ctx.role === "teacher" && s.mine && <Badge tone="primary" className="ms-2">You teach</Badge>}
                  </p>
                  <p className="text-[13px] text-muted">
                    {s.studentCount} student{s.studentCount === 1 ? "" : "s"}
                    {!admin && ` · ${s.teacherName ?? "No teacher"}`}
                  </p>
                </div>
                {admin && (
                  <div className="flex items-center gap-1">
                    <TeacherPicker classSubjectId={s.id} teacherId={s.teacherId} teachers={teachers} />
                    <SubjectRowMenu classSubjectId={s.id} name={s.subjectName} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {admin && (
        <>
          <SectionTitle>Danger zone</SectionTitle>
          <Card>
            <CardBody className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">Remove a class that is no longer running. History is kept.</p>
              <RemoveClassButton classId={id} name={cls.name} studentCount={studentCount} />
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}
