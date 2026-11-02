import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { requireCtx } from "@/server/auth/session";
import { listSubjects } from "@/server/modules/org";
import { SubjectsClient } from "./subjects-client";

export const metadata: Metadata = { title: "Subjects" };

export default async function SubjectsPage() {
  const ctx = await requireCtx(["super_admin", "admin"]);
  const subjects = await listSubjects(ctx.academyId);
  return (
    <>
      <PageHeader title="Subjects" subtitle="Academy-wide subject list" back="/more" />
      <SubjectsClient subjects={subjects.map(({ archivedAt: _a, ...s }) => s)} />
    </>
  );
}
