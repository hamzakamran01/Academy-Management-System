import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { todayPkt } from "@/lib/dates";
import { requireCtx } from "@/server/auth/session";
import { getAcademy } from "@/server/modules/academy";
import { getStudentProfile, studentFormOptions } from "@/server/modules/students";
import { StudentForm } from "../../student-form";

export const metadata: Metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin"]);
  const { id } = await params;
  const [s, classes, academy] = await Promise.all([getStudentProfile(ctx, id), studentFormOptions(ctx), getAcademy(ctx.academyId)]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit student" subtitle={`${s.name} · ${s.registrationNo}`} back={`/students/${id}`} />
      <StudentForm
        mode="edit"
        studentId={id}
        classes={classes}
        today={todayPkt()}
        academyName={academy.name}
        initial={{
          name: s.name,
          guardianName: s.guardianName,
          gender: s.gender,
          dob: s.dob ?? "",
          address: s.address ?? "",
          notes: s.notes ?? "",
          admissionDate: s.admissionDate,
          classId: s.current?.classId ?? "",
          rollNo: s.current?.rollNo ?? "",
          excluded: s.subjects.filter((x) => x.excluded).map((x) => x.classSubjectId),
          parents: [],
        }}
      />
    </div>
  );
}
