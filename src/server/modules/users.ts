import "server-only";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { classes, classSubjects, classSubjectTeachers, parentLinks, roleAssignments, sessions, setupTokens, students, subjects, users } from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { badRequest, forbidden, notFound } from "@/server/http";
import { issueSetupToken, setupUrl } from "./auth";
import { logActivity } from "./audit";
import { getCurrentYear } from "./academy";

/** Who may manage accounts of a given role (PRD §3.2). */
export function canManageRole(actor: Role, target: Role): boolean {
  if (actor === "super_admin") return target !== "super_admin";
  if (actor === "admin") return target === "teacher" || target === "parent";
  return false;
}

export type CreatedAccount = { userId: string; created: boolean; setupLink: string | null; name: string; phone: string };

/**
 * Create an account, or add the role to the existing person with that phone
 * (BR-AUTH-02). Issues a setup link if the person has never set a password.
 */
export async function ensureUserWithRole(
  tx: Tx,
  ctx: Ctx,
  input: { name: string; phone: string; role: Role },
): Promise<CreatedAccount> {
  if (!canManageRole(ctx.role, input.role)) throw forbidden(`You can't create ${ROLE_LABEL[input.role]} accounts`);
  const phone = normalizePhone(input.phone);
  if (!phone) throw badRequest("INVALID_PHONE", PHONE_ERROR, { fields: { phone: PHONE_ERROR } });

  let [user] = await tx.select().from(users).where(eq(users.phone, phone));
  let created = false;
  if (!user) {
    [user] = await tx.insert(users).values({ academyId: ctx.academyId, phone, name: input.name.trim() }).returning();
    created = true;
  }
  const u = user!;
  const [existingRole] = await tx
    .select()
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, u.id), eq(roleAssignments.role, input.role)));
  if (!existingRole) await tx.insert(roleAssignments).values({ userId: u.id, role: input.role });
  else if (!existingRole.active) await tx.update(roleAssignments).set({ active: true }).where(eq(roleAssignments.id, existingRole.id));

  let setupLink: string | null = null;
  if (!u.passwordHash) setupLink = setupUrl(await issueSetupToken(tx, u.id, ctx.userId));

  if (created || !existingRole || !existingRole.active) {
    await logActivity(tx, ctx, {
      action: "account.create",
      entityType: "user",
      entityId: u.id,
      summary: `${created ? "Created" : "Added"} ${ROLE_LABEL[input.role]} account for ${u.name}`,
      after: { role: input.role, phone },
    });
  }
  return { userId: u.id, created, setupLink, name: u.name, phone };
}

export async function createAccount(ctx: Ctx, input: { name: string; phone: string; role: Role }) {
  return db.transaction((tx) => ensureUserWithRole(tx, ctx, input));
}

async function loadTarget(ctx: Ctx, userId: string, role: Role) {
  if (!canManageRole(ctx.role, role)) throw forbidden();
  const [row] = await db
    .select({ id: users.id, name: users.name, academyId: users.academyId })
    .from(users)
    .innerJoin(roleAssignments, and(eq(roleAssignments.userId, users.id), eq(roleAssignments.role, role)))
    .where(eq(users.id, userId));
  if (!row || row.academyId !== ctx.academyId) throw notFound("Account");
  return row;
}

/** FR-AUTH-08: deactivate one role; if it was the person's last active role the user is deactivated. */
export async function setRoleActive(ctx: Ctx, userId: string, role: Role, active: boolean) {
  const target = await loadTarget(ctx, userId, role);
  if (target.id === ctx.userId) throw badRequest("SELF", "You can't deactivate your own account");
  await db.transaction(async (tx) => {
    await tx.update(roleAssignments).set({ active }).where(and(eq(roleAssignments.userId, userId), eq(roleAssignments.role, role)));
    const remaining = await tx
      .select({ role: roleAssignments.role })
      .from(roleAssignments)
      .where(and(eq(roleAssignments.userId, userId), eq(roleAssignments.active, true)));
    await tx.update(users).set({ status: remaining.length ? "active" : "deactivated" }).where(eq(users.id, userId));
    if (!active) {
      // BR-AUTH-08: revoke that role's sessions immediately
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.userId, userId), eq(sessions.role, role), isNull(sessions.revokedAt)));
    }
    await logActivity(tx, ctx, {
      action: active ? "account.activate" : "account.deactivate",
      entityType: "user",
      entityId: userId,
      summary: `${active ? "Reactivated" : "Deactivated"} ${ROLE_LABEL[role]} account of ${target.name}`,
    });
  });
}

/** FR-AUTH-04: new setup link (also used for "forgot password"). */
export async function newSetupLink(ctx: Ctx, userId: string, role: Role) {
  const target = await loadTarget(ctx, userId, role);
  const raw = await db.transaction(async (tx) => {
    const t = await issueSetupToken(tx, userId, ctx.userId);
    await logActivity(tx, ctx, { action: "account.setup_link", entityType: "user", entityId: userId, summary: `New setup link for ${target.name}` });
    return t;
  });
  return setupUrl(raw);
}

export async function updateAccount(ctx: Ctx, userId: string, role: Role, input: { name?: string; phone?: string }) {
  const target = await loadTarget(ctx, userId, role);
  const patch: { name?: string; phone?: string } = {};
  if (input.name?.trim()) patch.name = input.name.trim();
  if (input.phone) {
    const p = normalizePhone(input.phone);
    if (!p) throw badRequest("INVALID_PHONE", PHONE_ERROR, { fields: { phone: PHONE_ERROR } });
    const [clash] = await db.select({ id: users.id }).from(users).where(and(eq(users.phone, p), sql`${users.id} <> ${userId}`));
    if (clash) throw badRequest("PHONE_TAKEN", "Another account already uses this number", { fields: { phone: "Another account already uses this number" } });
    patch.phone = p;
  }
  await db.transaction(async (tx) => {
    await tx.update(users).set(patch).where(eq(users.id, userId));
    await logActivity(tx, ctx, { action: "account.update", entityType: "user", entityId: userId, summary: `Updated account of ${target.name}`, after: patch });
  });
}

export type PersonRow = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  invited: boolean; // has never set a password
  lastActiveAt: Date | null;
};

/** People list for a role — never includes salary fields (FR-SAL-04). */
export async function listPeople(ctx: Ctx, role: Role, q?: string): Promise<PersonRow[]> {
  if (!canManageRole(ctx.role, role) && !(ctx.role === "admin" && role === "admin")) throw forbidden();
  const term = q?.trim();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      active: roleAssignments.active,
      passwordHash: users.passwordHash,
      lastActiveAt: users.lastActiveAt,
    })
    .from(users)
    .innerJoin(roleAssignments, and(eq(roleAssignments.userId, users.id), eq(roleAssignments.role, role)))
    .where(
      and(
        eq(users.academyId, ctx.academyId),
        term ? or(ilike(users.name, `%${term}%`), ilike(users.phone, `%${term.replace(/^0/, "")}%`)) : undefined,
      ),
    )
    .orderBy(sql`${roleAssignments.active} desc`, asc(users.name));
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, active: r.active, invited: !r.passwordHash, lastActiveAt: r.lastActiveAt }));
}

/** Teacher picker options (active teachers). */
export async function teacherOptions(academyId: string) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(roleAssignments, and(eq(roleAssignments.userId, users.id), eq(roleAssignments.role, "teacher"), eq(roleAssignments.active, true)))
    .where(eq(users.academyId, academyId))
    .orderBy(asc(users.name));
}

/** Teacher profile: their current assignments (no salary — FR-SAL-04). */
export async function teacherProfile(ctx: Ctx, teacherId: string) {
  if (ctx.role !== "super_admin" && ctx.role !== "admin" && ctx.userId !== teacherId) throw forbidden();
  const [person] = await db
    .select({ id: users.id, name: users.name, phone: users.phone, status: users.status, passwordHash: users.passwordHash, lastActiveAt: users.lastActiveAt, active: roleAssignments.active })
    .from(users)
    .innerJoin(roleAssignments, and(eq(roleAssignments.userId, users.id), eq(roleAssignments.role, "teacher")))
    .where(and(eq(users.id, teacherId), eq(users.academyId, ctx.academyId)));
  if (!person) throw notFound("Teacher");
  const year = await getCurrentYear(ctx.academyId);
  const assignments = year
    ? await db
        .select({ classSubjectId: classSubjects.id, classId: classes.id, className: classes.name, subjectName: subjects.name, fromDate: classSubjectTeachers.fromDate })
        .from(classSubjectTeachers)
        .innerJoin(classSubjects, eq(classSubjects.id, classSubjectTeachers.classSubjectId))
        .innerJoin(classes, eq(classes.id, classSubjects.classId))
        .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
        .where(and(eq(classSubjectTeachers.teacherId, teacherId), isNull(classSubjectTeachers.toDate), isNull(classes.archivedAt), eq(classes.academicYearId, year.id)))
        .orderBy(asc(classes.level), asc(classes.name), asc(subjects.name))
    : [];
  return {
    id: person.id,
    name: person.name,
    phone: person.phone,
    active: person.active,
    invited: !person.passwordHash,
    lastActiveAt: person.lastActiveAt,
    assignments,
  };
}

/** Parent list with their linked children. */
export async function listParents(ctx: Ctx, q?: string) {
  const people = await listPeople(ctx, "parent", q);
  if (!people.length) return [];
  const links = await db
    .select({ parentId: parentLinks.parentUserId, studentId: students.id, studentName: students.name, status: students.status })
    .from(parentLinks)
    .innerJoin(students, eq(students.id, parentLinks.studentId))
    .where(inArray(parentLinks.parentUserId, people.map((p) => p.id)));
  return people.map((p) => ({ ...p, children: links.filter((l) => l.parentId === p.id) }));
}

export async function pendingInvites(userIds: string[]) {
  if (!userIds.length) return new Set<string>();
  const rows = await db
    .select({ userId: setupTokens.userId })
    .from(setupTokens)
    .where(and(inArray(setupTokens.userId, userIds), isNull(setupTokens.usedAt)));
  return new Set(rows.map((r) => r.userId));
}
