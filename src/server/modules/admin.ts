import "server-only";
import { and, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { academy, activityLog, assessments, classSubjectTeachers, roleAssignments, students, users } from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { addDays, todayPkt } from "@/lib/dates";
import { resolveSettings, settingsSchema, type AcademySettings } from "@/lib/settings";
import { isStaffAdmin } from "@/lib/roles";
import { forbidden } from "@/server/http";
import { logActivity } from "./audit";
import { teacherConsistency } from "./teaching";

// ─── Activity log (FR-ADM-01/02) ────────────────────────────────────────────
export async function listActivity(ctx: Ctx, f: { q?: string; entityType?: string; from?: string; to?: string; limit?: number; offset?: number }) {
  if (!isStaffAdmin(ctx.role)) throw forbidden();
  const conds: (SQL | undefined)[] = [eq(activityLog.academyId, ctx.academyId)];
  // BR-ADM-02: admins never see fee-amount or salary entries.
  if (ctx.role === "admin") conds.push(eq(activityLog.sensitivity, "normal"));
  if (f.entityType) conds.push(eq(activityLog.entityType, f.entityType));
  if (f.q?.trim()) conds.push(ilike(activityLog.summary, `%${f.q.trim()}%`));
  if (f.from) conds.push(gte(activityLog.at, new Date(`${f.from}T00:00:00+05:00`)));
  if (f.to) conds.push(lte(activityLog.at, new Date(`${f.to}T23:59:59+05:00`)));
  return db
    .select({
      id: activityLog.id,
      at: activityLog.at,
      action: activityLog.action,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      summary: activityLog.summary,
      before: activityLog.before,
      after: activityLog.after,
      reason: activityLog.reason,
      sensitivity: activityLog.sensitivity,
      actorName: users.name,
      actorRole: activityLog.actorRole,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorId))
    .where(and(...conds))
    .orderBy(desc(activityLog.at))
    .limit(Math.min(f.limit ?? 50, 200))
    .offset(f.offset ?? 0);
}

// ─── Settings (FR-ADM-03, FR-ORG-01) ────────────────────────────────────────
export async function getAcademySettings(ctx: Ctx) {
  if (ctx.role !== "super_admin") throw forbidden();
  const [a] = await db.select().from(academy).where(eq(academy.id, ctx.academyId));
  return { name: a!.name, address: a!.address, phone: a!.phone, settings: resolveSettings(a!.settings) };
}

export async function updateAcademySettings(ctx: Ctx, input: { name: string; address: string | null; phone: string | null; settings: AcademySettings }) {
  if (ctx.role !== "super_admin") throw forbidden();
  const settings = settingsSchema.parse(input.settings);
  settings.gradeScale.sort((a, b) => b.minPercent - a.minPercent);
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(academy).where(eq(academy.id, ctx.academyId));
    await tx.update(academy).set({ name: input.name.trim(), address: input.address?.trim() || null, phone: input.phone?.trim() || null, settings }).where(eq(academy.id, ctx.academyId));
    await logActivity(tx, ctx, { action: "settings.update", entityType: "academy", entityId: ctx.academyId, summary: "Updated academy settings", before: { name: before?.name, settings: before?.settings }, after: { name: input.name, settings } });
  });
}

// ─── Teacher summary (daily logs + tests) ───────────────────────────────────
export type TeacherSummary = {
  subjects: number;
  workingDays: number;
  logDaysPct: number | null;
  missedDays: number;
  testsOnTimePct: number | null;
  testsPublished: number;
};

/** Separate, plain numbers — no combined score. `days` = working days looked back (today excluded). */
export async function teacherSummary(ctx: Ctx, teacherId: string, days = 20): Promise<TeacherSummary> {
  if (!isStaffAdmin(ctx.role) && ctx.userId !== teacherId) throw forbidden();
  const [c] = await teacherConsistency(ctx, { count: days, teacherId });
  if (!c) return { subjects: 0, workingDays: 0, logDaysPct: null, missedDays: 0, testsOnTimePct: null, testsPublished: 0 };
  const from = c.days[0]?.date ?? todayPkt();
  const csIds = (
    await db
      .select({ id: classSubjectTeachers.classSubjectId })
      .from(classSubjectTeachers)
      .where(and(eq(classSubjectTeachers.teacherId, teacherId), isNull(classSubjectTeachers.toDate)))
  ).map((r) => r.id);
  const testCutoff = addDays(todayPkt(), -3);
  const [tests] = csIds.length
    ? await db
        .select({
          due: sql<number>`count(*) filter (where ${assessments.date} <= ${testCutoff}::date)::int`,
          onTime: sql<number>`count(*) filter (where ${assessments.date} <= ${testCutoff}::date and ${assessments.publishedAt} is not null and (${assessments.publishedAt} at time zone 'Asia/Karachi')::date <= ${assessments.date} + 3)::int`,
          published: sql<number>`count(*) filter (where ${assessments.publishedAt} is not null)::int`,
        })
        .from(assessments)
        .where(and(inArray(assessments.classSubjectId, csIds), gte(assessments.date, from), lte(assessments.date, todayPkt())))
    : [{ due: 0, onTime: 0, published: 0 }];
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
  return {
    subjects: c.subjects,
    workingDays: c.days.length,
    logDaysPct: c.pct,
    missedDays: c.missedDays,
    testsOnTimePct: pct(tests?.onTime ?? 0, tests?.due ?? 0),
    testsPublished: tests?.published ?? 0,
  };
}

// ─── People status (FR-DSH-05) ──────────────────────────────────────────────
export async function peopleStatus(ctx: Ctx) {
  if (ctx.role !== "super_admin") throw forbidden();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const from = addDays(todayPkt(), -27);
  const to = todayPkt();
  const staff = await db
    .select({ id: users.id, name: users.name, role: roleAssignments.role, lastActiveAt: users.lastActiveAt })
    .from(users)
    .innerJoin(roleAssignments, and(eq(roleAssignments.userId, users.id), eq(roleAssignments.active, true), inArray(roleAssignments.role, ["admin", "teacher"])))
    .where(eq(users.academyId, ctx.academyId))
    .orderBy(users.name);
  const actions = await db
    .select({ actorId: activityLog.actorId, n: count() })
    .from(activityLog)
    .where(and(eq(activityLog.academyId, ctx.academyId), gte(activityLog.at, since)))
    .groupBy(activityLog.actorId);
  const actionCount = new Map(actions.map((a) => [a.actorId, a.n]));
  const teachers: ((typeof staff)[number] & { summary: TeacherSummary; actions: number })[] = [];
  const summaries = await Promise.all(staff.filter((s) => s.role === "teacher").map((t) => teacherSummary(ctx, t.id)));
  staff.filter((s) => s.role === "teacher").forEach((t, i) => teachers.push({ ...t, summary: summaries[i]!, actions: actionCount.get(t.id) ?? 0 }));
  const [[active], [removed], [parentsTotal], [parentsIn]] = await Promise.all([
    db.select({ n: count() }).from(students).where(and(eq(students.academyId, ctx.academyId), eq(students.status, "active"))),
    db.select({ n: count() }).from(students).where(and(eq(students.academyId, ctx.academyId), eq(students.status, "removed"))),
    db.select({ n: count() }).from(users).innerJoin(roleAssignments, and(eq(roleAssignments.userId, users.id), eq(roleAssignments.role, "parent"), eq(roleAssignments.active, true))).where(eq(users.academyId, ctx.academyId)),
    db.select({ n: count() }).from(users).innerJoin(roleAssignments, and(eq(roleAssignments.userId, users.id), eq(roleAssignments.role, "parent"), eq(roleAssignments.active, true))).where(and(eq(users.academyId, ctx.academyId), isNotNull(users.lastLoginAt))),
  ]);
  return {
    period: { from, to },
    admins: staff.filter((s) => s.role === "admin").map((a) => ({ ...a, actions: actionCount.get(a.id) ?? 0 })),
    teachers,
    students: { active: active?.n ?? 0, removed: removed?.n ?? 0 },
    parents: { total: parentsTotal?.n ?? 0, loggedIn: parentsIn?.n ?? 0 },
  };
}
