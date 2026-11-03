import { BookOpen, Library, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { isStaffAdmin } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { getCurrentYear } from "@/server/modules/academy";
import { listClasses, listSubjects } from "@/server/modules/org";
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
  const [rows, subjects] = await Promise.all([listClasses(ctx), admin ? listSubjects(ctx.academyId) : Promise.resolve([])]);
  const totalStudents = rows.reduce((n, r) => n + r.studentCount, 0);

  return (
    <>
      <PageHeader
        title={admin ? "Classes" : "My classes"}
        subtitle={`${year.name} · ${rows.length} classes · ${totalStudents} students`}
        actions={admin && <AddClassButton subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} />}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={Library}
          title={admin ? "No classes yet" : "No classes assigned"}
          description={admin ? "Add your first class, attach subjects and assign teachers." : "Ask the office to assign you to a class subject."}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/classes/${c.id}`} className="block h-full">
                <Card className="h-full p-4 transition-colors hover:bg-surface-2 active:bg-surface-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{c.name}</p>
                      {c.shift && <p className="text-[13px] text-muted">{c.shift} shift</p>}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Users className="size-4 text-muted" aria-hidden />
                      <span className="tabular">{c.studentCount}</span>
                      <span className="text-muted">students</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <BookOpen className="size-4 text-muted" aria-hidden />
                      <span className="tabular">{c.subjectCount}</span>
                      <span className="text-muted">subjects</span>
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
