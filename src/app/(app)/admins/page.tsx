import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PeopleList } from "@/components/people-list";
import { requireCtx } from "@/server/auth/session";
import { getAcademy } from "@/server/modules/academy";
import { listPeople } from "@/server/modules/users";

export const metadata: Metadata = { title: "Admins" };

export default async function AdminsPage() {
  const ctx = await requireCtx(["super_admin"]);
  const [people, academy] = await Promise.all([listPeople(ctx, "admin"), getAcademy(ctx.academyId)]);
  return (
    <>
      <PageHeader title="Admins" subtitle="Office staff who run day-to-day operations" />
      <PeopleList
        role="admin"
        canAdd
        hrefBase="/admins"
        academyName={academy.name}
        people={people.map((p) => ({ ...p, lastActiveAt: p.lastActiveAt?.toISOString() ?? null }))}
      />
    </>
  );
}
