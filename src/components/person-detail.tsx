import { and, eq } from "drizzle-orm";
import { GraduationCap } from "lucide-react";
import { notFound } from "next/navigation";
import { AccountActions } from "@/components/account-actions";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, SectionTitle } from "@/components/ui/card";
import { Avatar, ListCard, ListRow } from "@/components/ui/data";
import { formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { Role } from "@/lib/roles";
import type { Ctx } from "@/server/auth/session";
import { db } from "@/server/db";
import { parentLinks, roleAssignments, students, users } from "@/server/db/schema";
import { getAcademy } from "@/server/modules/academy";

/** Account detail for parents and admins (teachers have their own richer page). */
export async function PersonDetail({ ctx, id, role, back }: { ctx: Ctx; id: string; role: Role; back: string }) {
  const [p] = await db
    .select({ id: users.id, name: users.name, phone: users.phone, passwordHash: users.passwordHash, lastActiveAt: users.lastActiveAt, active: roleAssignments.active })
    .from(users)
    .innerJoin(roleAssignments, and(eq(roleAssignments.userId, users.id), eq(roleAssignments.role, role)))
    .where(and(eq(users.id, id), eq(users.academyId, ctx.academyId)));
  if (!p) notFound();
  const academy = await getAcademy(ctx.academyId);
  const children =
    role === "parent"
      ? await db
          .select({ id: students.id, name: students.name, reg: students.registrationNo, status: students.status, relation: parentLinks.relation })
          .from(parentLinks)
          .innerJoin(students, eq(students.id, parentLinks.studentId))
          .where(eq(parentLinks.parentUserId, id))
      : [];

  return (
    <>
      <PageHeader title={p.name} back={back} />
      <Card className="mb-5">
        <CardBody className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center">
          <Avatar name={p.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold">{p.name}</p>
              {!p.active ? <StatusBadge status="deactivated" /> : !p.passwordHash ? <StatusBadge status="invited" /> : <StatusBadge status="active" />}
            </div>
            <p className="text-sm text-muted">
              {formatPhone(p.phone)}
              {p.lastActiveAt && ` · last active ${formatRelative(p.lastActiveAt)}`}
            </p>
          </div>
          <AccountActions userId={p.id} role={role} name={p.name} phone={p.phone} active={p.active} academyName={academy.name} />
        </CardBody>
      </Card>
      {role === "parent" && (
        <>
          <SectionTitle>Children</SectionTitle>
          <ListCard>
            {children.map((c) => (
              <ListRow
                key={c.id}
                href={`/students/${c.id}`}
                leading={<Avatar name={c.name} />}
                title={c.name}
                subtitle={`${c.reg} · ${c.relation}`}
                trailing={<StatusBadge status={c.status} />}
              />
            ))}
            {!children.length && (
              <ListRow leading={<GraduationCap className="size-5 text-muted" />} title="No children linked" />
            )}
          </ListCard>
        </>
      )}
    </>
  );
}
