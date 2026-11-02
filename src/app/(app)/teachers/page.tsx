import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PeopleList } from "@/components/people-list";
import { requireCtx } from "@/server/auth/session";
import { getAcademy } from "@/server/modules/academy";
import { listPeople } from "@/server/modules/users";

export const metadata: Metadata = { title: "Teachers" };

export default async function TeachersPage() {
  const ctx = await requireCtx(["super_admin", "admin"]);
  const [people, academy] = await Promise.all([listPeople(ctx, "teacher"), getAcademy(ctx.academyId)]);
  return (
    <>
      <PageHeader title="Teachers" subtitle="Accounts, class assignments and progress" />
      <PeopleList
        role="teacher"
        canAdd
        hrefBase="/teachers"
        academyName={academy.name}
        people={people.map((p) => ({ ...p, lastActiveAt: p.lastActiveAt?.toISOString() ?? null }))}
      />
    </>
  );
}
