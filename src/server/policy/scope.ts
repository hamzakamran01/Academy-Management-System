import "server-only";
import { and, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/server/db";
import { classes, classSubjects, classSubjectTeachers, enrollments, parentLinks, students } from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { isStaffAdmin } from "@/lib/roles";
import { forbidden } from "@/server/http";
import { getCurrentYear } from "@/server/modules/academy";
import { addDays, todayPkt } from "@/lib/dates";

/**
 * Role scoping (SRS §5.2, §5.3). Every query that returns people or their
 * records filters through these sets. Cached per request.
 */

/** class_subjects with an open assignment to this teacher, in the current year. */
export const teacherClassSubjectIds = cache(async (userId: string, academyId: string): Promise<string[]> => {
  const year = await getCurrentYear(academyId);
  if (!year) return [];
  const rows = await db
    .select({ id: classSubjects.id })
    .from(classSubjectTeachers)
    .innerJoin(classSubjects, eq(classSubjects.id, classSubjectTeachers.classSubjectId))
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .where(
      and(
        eq(classSubjectTeachers.teacherId, userId),
        isNull(classSubjectTeachers.toDate),
        isNull(classSubjects.archivedAt),
        isNull(classes.archivedAt),
        eq(classes.academicYearId, year.id),
      ),
    );
  return rows.map((r) => r.id);
});

/** Classes of those class_subjects ∪ the class where they are class teacher. */
export const teacherClassIds = cache(async (userId: string, academyId: string): Promise<string[]> => {
  const year = await getCurrentYear(academyId);
  if (!year) return [];
  const csIds = await teacherClassSubjectIds(userId, academyId);
  const rows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(
      and(
        eq(classes.academicYearId, year.id),
        isNull(classes.archivedAt),
        or(
          eq(classes.classTeacherId, userId),
          csIds.length
            ? inArray(classes.id, db.select({ id: classSubjects.classId }).from(classSubjects).where(inArray(classSubjects.id, csIds)))
            : sql`false`,
        ),
      ),
    );
  return rows.map((r) => r.id);
});

/** BR-PARENT: linked students who are active, or removed within the last 30 days (read-only). */
export const parentStudentIds = cache(async (userId: string): Promise<{ id: string; readOnly: boolean }[]> => {
  const cutoff = addDays(todayPkt(), -30);
  const rows = await db
    .select({ id: students.id, status: students.status })
    .from(parentLinks)
    .innerJoin(students, eq(students.id, parentLinks.studentId))
    .where(
      and(
        eq(parentLinks.parentUserId, userId),
        or(eq(students.status, "active"), and(eq(students.status, "removed"), gte(students.removedOn, cutoff))),
      ),
    );
  return rows.map((r) => ({ id: r.id, readOnly: r.status !== "active" }));
});

/** Throws 403 unless the current user may see this student. */
export async function assertStudentVisible(ctx: Ctx, studentId: string): Promise<void> {
  if (isStaffAdmin(ctx.role)) return;
  if (ctx.role === "parent") {
    const ids = await parentStudentIds(ctx.userId);
    if (ids.some((s) => s.id === studentId)) return;
    throw forbidden();
  }
  // teacher: open enrollment in one of their classes
  const classIds = await teacherClassIds(ctx.userId, ctx.academyId);
  if (classIds.length) {
    const [hit] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), isNull(enrollments.toDate), inArray(enrollments.classId, classIds)));
    if (hit) return;
  }
  throw forbidden();
}

export async function assertClassVisible(ctx: Ctx, classId: string): Promise<void> {
  if (isStaffAdmin(ctx.role)) return;
  if (ctx.role === "teacher" && (await teacherClassIds(ctx.userId, ctx.academyId)).includes(classId)) return;
  throw forbidden();
}

export async function assertClassSubjectTeachable(ctx: Ctx, classSubjectId: string): Promise<void> {
  if (isStaffAdmin(ctx.role)) return;
  if (ctx.role === "teacher" && (await teacherClassSubjectIds(ctx.userId, ctx.academyId)).includes(classSubjectId)) return;
  throw forbidden();
}

export function assertRole(ctx: Ctx, ...roles: Ctx["role"][]): void {
  if (!roles.includes(ctx.role)) throw forbidden();
}
