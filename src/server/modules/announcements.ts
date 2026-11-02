import "server-only";
import { and, arrayOverlaps, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { announcements, classes, enrollments, parentLinks, roleAssignments, users } from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { isStaffAdmin, type Role } from "@/lib/roles";
import { badRequest, forbidden, notFound } from "@/server/http";
import { parentStudentIds, teacherClassIds } from "@/server/policy/scope";
import { logActivity } from "./audit";
import { queueNotifications } from "./notify";

export type AnnouncementInput = {
  title: string;
  body: string;
  audienceType: "all" | "parents" | "teachers" | "classes";
  classIds?: string[];
  pinned?: boolean;
};

/** FR-NOT-01 / BR-NOT-04: audience resolved at publish time; teachers only to their own classes. */
export async function createAnnouncement(ctx: Ctx, input: AnnouncementInput) {
  let classIds = [...new Set(input.classIds ?? [])];
  if (ctx.role === "teacher") {
    const mine = await teacherClassIds(ctx.userId, ctx.academyId);
    if (input.audienceType !== "classes" || !classIds.length || classIds.some((c) => !mine.includes(c))) {
      throw forbidden("Teachers can announce only to their own classes");
    }
  } else if (!isStaffAdmin(ctx.role)) throw forbidden();
  if (input.audienceType === "classes" && !classIds.length) throw badRequest("NO_CLASSES", "Choose at least one class", { fields: { classIds: "Choose at least one class" } });
  if (input.audienceType !== "classes") classIds = [];
  const pinned = isStaffAdmin(ctx.role) ? !!input.pinned : false;

  // Resolve recipients (outside the transaction — read-only)
  const recipients: { userId: string; role: Role }[] = [];
  const academyUsers = (r: Role) =>
    db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(roleAssignments, and(eq(roleAssignments.userId, users.id), eq(roleAssignments.role, r), eq(roleAssignments.active, true)))
      .where(and(eq(users.academyId, ctx.academyId), eq(users.status, "active")));
  if (input.audienceType === "all" || input.audienceType === "parents") recipients.push(...(await academyUsers("parent")).map((u) => ({ userId: u.userId, role: "parent" as const })));
  if (input.audienceType === "all" || input.audienceType === "teachers") recipients.push(...(await academyUsers("teacher")).map((u) => ({ userId: u.userId, role: "teacher" as const })));
  if (input.audienceType === "all") recipients.push(...(await academyUsers("admin")).map((u) => ({ userId: u.userId, role: "admin" as const })));
  if (input.audienceType === "classes") {
    const ps = await db
      .selectDistinct({ userId: parentLinks.parentUserId })
      .from(parentLinks)
      .innerJoin(enrollments, and(eq(enrollments.studentId, parentLinks.studentId), isNull(enrollments.toDate)))
      .innerJoin(roleAssignments, and(eq(roleAssignments.userId, parentLinks.parentUserId), eq(roleAssignments.role, "parent"), eq(roleAssignments.active, true)))
      .where(inArray(enrollments.classId, classIds));
    recipients.push(...ps.map((p) => ({ userId: p.userId, role: "parent" as const })));
  }
  const unique = [...new Map(recipients.filter((r) => r.userId !== ctx.userId).map((r) => [`${r.userId}:${r.role}`, r])).values()];

  return db.transaction(async (tx) => {
    const [a] = await tx
      .insert(announcements)
      .values({ academyId: ctx.academyId, title: input.title.trim(), body: input.body.trim(), audienceType: input.audienceType, classIds, pinned, authorId: ctx.userId })
      .returning();
    await queueNotifications(
      tx,
      unique.map((r) => ({
        userId: r.userId,
        role: r.role,
        type: "announcement",
        title: input.title.trim(),
        body: input.body.trim().slice(0, 280),
        pushText: input.title.trim().slice(0, 120),
        link: `/announcements#a-${a!.id}`,
      })),
    );
    await logActivity(tx, ctx, { action: "announcement.create", entityType: "announcement", entityId: a!.id, summary: `Posted announcement “${a!.title}” to ${unique.length} people` });
    return { id: a!.id, recipients: unique.length };
  });
}

/** Announcements the viewer is in the audience of (staff see all). */
export async function listAnnouncements(ctx: Ctx, limit = 50) {
  let where;
  if (isStaffAdmin(ctx.role)) where = eq(announcements.academyId, ctx.academyId);
  else if (ctx.role === "teacher") {
    const mine = await teacherClassIds(ctx.userId, ctx.academyId);
    where = and(
      eq(announcements.academyId, ctx.academyId),
      or(
        inArray(announcements.audienceType, ["all", "teachers"]),
        eq(announcements.authorId, ctx.userId),
        mine.length ? and(eq(announcements.audienceType, "classes"), arrayOverlaps(announcements.classIds, mine)) : sql`false`,
      ),
    );
  } else {
    const kids = (await parentStudentIds(ctx.userId)).map((k) => k.id);
    const classIds = kids.length
      ? (await db.selectDistinct({ id: enrollments.classId }).from(enrollments).where(and(inArray(enrollments.studentId, kids), isNull(enrollments.toDate)))).map((c) => c.id)
      : [];
    where = and(
      eq(announcements.academyId, ctx.academyId),
      or(inArray(announcements.audienceType, ["all", "parents"]), classIds.length ? and(eq(announcements.audienceType, "classes"), arrayOverlaps(announcements.classIds, classIds)) : sql`false`),
    );
  }
  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      audienceType: announcements.audienceType,
      classIds: announcements.classIds,
      pinned: announcements.pinned,
      publishedAt: announcements.publishedAt,
      authorName: users.name,
      authorId: announcements.authorId,
    })
    .from(announcements)
    .innerJoin(users, eq(users.id, announcements.authorId))
    .where(where)
    .orderBy(desc(announcements.pinned), desc(announcements.publishedAt))
    .limit(limit);
  const allClassIds = [...new Set(rows.flatMap((r) => r.classIds))];
  const names = allClassIds.length ? new Map((await db.select({ id: classes.id, name: classes.name }).from(classes).where(inArray(classes.id, allClassIds))).map((c) => [c.id, c.name])) : new Map<string, string>();
  return rows.map((r) => ({ ...r, classNames: r.classIds.map((id) => names.get(id) ?? "Class") }));
}

export async function deleteAnnouncement(ctx: Ctx, id: string) {
  const [a] = await db.select().from(announcements).where(and(eq(announcements.id, id), eq(announcements.academyId, ctx.academyId)));
  if (!a) throw notFound("Announcement");
  if (!isStaffAdmin(ctx.role) && a.authorId !== ctx.userId) throw forbidden();
  await db.transaction(async (tx) => {
    await tx.delete(announcements).where(eq(announcements.id, id));
    await logActivity(tx, ctx, { action: "announcement.delete", entityType: "announcement", entityId: id, summary: `Deleted announcement “${a.title}”` });
  });
}

export async function setPinned(ctx: Ctx, id: string, pinned: boolean) {
  if (!isStaffAdmin(ctx.role)) throw forbidden();
  await db.update(announcements).set({ pinned }).where(and(eq(announcements.id, id), eq(announcements.academyId, ctx.academyId)));
}
