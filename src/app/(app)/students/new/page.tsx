import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { todayPkt } from "@/lib/dates";
import { requireCtx } from "@/server/auth/session";
import { getAcademy } from "@/server/modules/academy";
import { studentFormOptions } from "@/server/modules/students";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Add student" };

export default async function NewStudentPage({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin"]);
  const [classes, academy, sp] = await Promise.all([studentFormOptions(ctx), getAcademy(ctx.academyId), searchParams]);
  const fromClass = classes.find((c) => c.id === sp.classId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Add student"
        subtitle={fromClass ? `To ${fromClass.name} · parent gets access the same day` : "Parent gets access the same day"}
        back={fromClass ? `/students?classId=${fromClass.id}` : "/students"}
      />
      <StudentForm
        mode="add"
        classes={classes}
        today={todayPkt()}
        academyName={academy.name}
        initial={fromClass ? { classId: fromClass.id } : undefined}
      />
    </div>
  );
}
