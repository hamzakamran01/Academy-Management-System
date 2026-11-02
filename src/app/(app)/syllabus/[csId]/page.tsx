import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { isStaffAdmin } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { getSettings } from "@/server/modules/academy";
import { classSubjectInfo, getSyllabus, sameSubjectTargets } from "@/server/modules/progress";
import { SyllabusBuilder } from "./syllabus-builder";

export const metadata: Metadata = { title: "Syllabus" };

/** A-12: syllabus builder (Admin/Owner; teachers if the setting allows). */
export default async function SyllabusPage({ params }: { params: Promise<{ csId: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const { csId } = await params;
  const settings = await getSettings(ctx.academyId);
  if (ctx.role === "teacher" && !settings.teacherCanEditSyllabus) notFound();
  const [info, tree, targets] = await Promise.all([
    classSubjectInfo(ctx, csId),
    getSyllabus(ctx, csId).catch((e) => {
      if (e instanceof ApiError && e.status === 403) notFound();
      throw e;
    }),
    isStaffAdmin(ctx.role) ? sameSubjectTargets(ctx, csId) : Promise.resolve([]),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Syllabus" subtitle={`${info.subjectName} · ${info.className}`} back={`/progress/${csId}`} />
      <SyllabusBuilder csId={csId} initial={tree} targets={targets} />
    </div>
  );
}
