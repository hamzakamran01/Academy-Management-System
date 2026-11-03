import { BookOpen, ClipboardList, GraduationCap, Users, Wallet } from "lucide-react";
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

  const quick = [
    { href: `/students?classId=${id}`, label: "Students", icon: Users, show: true },
    { href: `/results?classId=${id}`, label: "Results", icon: GraduationCap, show: true },
    { href: `/fees/class/${id}`, label: "Fees", icon: Wallet, show: isStaffAdmin(ctx.role) },
    { href: `/progress?classId=${id}`, label: "Teaching log", icon: ClipboardList, show: isStaffAdmin(ctx.role) },
  ].filter((q) => q.show);

  return (
    <>
      <PageHeader
        title={cls.name}
        subtitle={cls.shift ? `${cls.shift} shift` : undefined}
        back="/classes"
        actions={
          admin && (
            <EditClassButton
              values={{ id: cls.id, name: cls.name, shift: cls.shift }}
            />
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Students" value={studentCount} icon={Users} />
        <StatTile label="Subjects" value={cls.subjects.length} icon={BookOpen} tone="info" />
        {cls.monthlyFee !== undefined && (
          <StatTile label="Monthly fee" value={cls.monthlyFee != null ? formatMoney(cls.monthlyFee) : "Not set"} icon={Wallet} tone="success" href={ctx.role === "super_admin" ? "/fees/settings" : undefined} className="col-span-2 lg:col-span-1" />
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
              <li key={s.id} className="px-4 py-3 sm:flex sm:items-center sm:gap-3">
                {/* Phones: subject on its own line, teacher picker full-width below — nothing overlaps. */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-bold text-primary-soft-fg" aria-hidden>
                    {s.subjectName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2 font-medium">
                      <span className="truncate">{s.subjectName}</span>
                      {ctx.role === "teacher" && s.mine && <Badge tone="primary" className="shrink-0">You teach</Badge>}
                    </p>
                    <p className="truncate text-[13px] text-muted">
                      {s.studentCount} student{s.studentCount === 1 ? "" : "s"}
                      {!admin && ` · ${s.teacherName ?? "No teacher"}`}
                    </p>
                  </div>
                  {admin && (
                    <div className="sm:hidden">
                      <SubjectRowMenu classSubjectId={s.id} name={s.subjectName} />
                    </div>
                  )}
                </div>
                {admin && (
                  <div className="mt-2.5 flex items-center gap-1 ps-12 sm:mt-0 sm:w-64 sm:shrink-0 sm:ps-0">
                    <TeacherPicker classSubjectId={s.id} teacherId={s.teacherId} teachers={teachers} />
                    <div className="max-sm:hidden">
                      <SubjectRowMenu classSubjectId={s.id} name={s.subjectName} />
                    </div>
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
