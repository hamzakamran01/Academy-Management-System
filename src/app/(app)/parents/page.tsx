import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PeopleList } from "@/components/people-list";
import { formatPhone } from "@/lib/phone";
import { requireCtx } from "@/server/auth/session";
import { getAcademy } from "@/server/modules/academy";
import { listParents } from "@/server/modules/users";

export const metadata: Metadata = { title: "Parents" };

export default async function ParentsPage() {
  const ctx = await requireCtx(["super_admin", "admin"]);
  const [parents, academy] = await Promise.all([listParents(ctx), getAcademy(ctx.academyId)]);
  return (
    <>
      <PageHeader title="Parents" subtitle="Parent accounts are created when you add a student" />
      <PeopleList
        role="parent"
        canAdd={false}
        hrefBase="/parents"
        academyName={academy.name}
        people={parents.map((p) => ({
          ...p,
          lastActiveAt: p.lastActiveAt?.toISOString() ?? null,
          extra: `${formatPhone(p.phone)} · ${p.children.map((c) => c.studentName).join(", ") || "No children linked"}`,
        }))}
      />
    </>
  );
}
