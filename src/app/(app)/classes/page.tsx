import { BookOpen, Crown, Library, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/data";
import { isStaffAdmin } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { getCurrentYear } from "@/server/modules/academy";
import { listClasses, listSubjects } from "@/server/modules/org";
import { teacherOptions } from "@/server/modules/users";
import { AddClassButton } from "./class-form";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const year = await getCurrentYear(ctx.academyId);
  if (!year) {
    return (
      <>
        <PageHeader title="Classes" />
        <EmptyState icon={Library} title="No academic year yet" description="Set up the current academic year first." action={<ButtonLink href="/calendar">Open calendar</ButtonLink>} />
      </>
    );
  }
  const admin = isStaffAdmin(ctx.role);
  const [rows, teachers, subjects] = await Promise.all([
    listClasses(ctx),
    admin ? teacherOptions(ctx.academyId) : Promise.resolve([]),
    admin ? listSubjects(ctx.academyId) : Promise.resolve([]),
  ]);
  const totalStudents = rows.reduce((n, r) => n + r.studentCount, 0);

  return (
    <>
      <PageHeader
        title={admin ? "Classes" : "My classes"}
        subtitle={`${year.name} · ${rows.length} classes · ${totalStudents} students`}
        actions={admin && <AddClassButton teachers={teachers} subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} />}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={Library}
          title={admin ? "No classes yet" : "No classes assigned"}
          description={admin ? "Add your first class, attach subjects and assign teachers." : "Ask the office to assign you to a class subject."}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/classes/${c.id}`} className="block h-full">
                <Card className="h-full p-4 transition-colors hover:bg-surface-2 active:bg-surface-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{c.name}</p>
                      <p className="text-[13px] text-muted">
                        {c.shift ?? "No shift"}
                        {c.classTeacherName ? ` · ${c.classTeacherName}` : ""}
                      </p>
                    </div>
                    {ctx.role === "teacher" && c.classTeacherId === ctx.userId && (
                      <Badge tone="primary" icon={Crown}>Class teacher</Badge>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Users className="size-4 text-muted" aria-hidden />
                      <span className="tabular">{c.studentCount}</span>
                      {c.capacity ? <span className="text-muted">/ {c.capacity}</span> : <span className="text-muted">students</span>}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <BookOpen className="size-4 text-muted" aria-hidden />
                      <span className="tabular">{c.subjectCount}</span>
                      <span className="text-muted">subjects</span>
                    </span>
                  </div>
                  {c.capacity ? (
                    <ProgressBar
                      className="mt-3"
                      size="sm"
                      value={(c.studentCount / c.capacity) * 100}
                      tone={c.studentCount > c.capacity ? "danger" : "primary"}
                      label="Seats filled"
                    />
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
