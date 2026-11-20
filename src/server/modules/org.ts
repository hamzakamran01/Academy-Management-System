import "server-only";
// NOTE: correlated subqueries reference outer columns as quoted "table"."column".
// Drizzle prints bare "id" for single-table selects, which would bind to the inner table.
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import {
  academicYears,
  classes,
  classSubjects,
  classSubjectTeachers,
  enrollments,
  holidays,
  roleAssignments,
  subjects,
  users,
} from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { addDays, todayPkt } from "@/lib/dates";
import { isStaffAdmin } from "@/lib/roles";
import { badRequest, conflict, forbidden, notFound } from "@/server/http";
import { teacherClassIds, teacherClassSubjectIds } from "@/server/policy/scope";
import { logActivity } from "./audit";
import { requireCurrentYear } from "./academy";

const assertAdmin = (ctx: Ctx) => {
  if (!isStaffAdmin(ctx.role)) throw forbidden();
};

// ─── Subjects ───────────────────────────────────────────────────────────────
export async function listSubjects(academyId: string, includeArchived = false) {
  const rows = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
      archivedAt: subjects.archivedAt,
      classCount: sql<number>`(select count(*)::int from ${classSubjects} cs join ${classes} c on c.id = cs.class_id where cs.subject_id = "subjects"."id" and cs.archived_at is null and c.archived_at is null)`,
    })
    .from(subjects)
    .where(and(eq(subjects.academyId, academyId), includeArchived ? undefined : isNull(subjects.archivedAt)))
    .orderBy(asc(subjects.name));
  return rows;
}

export async function createSubject(ctx: Ctx, input: { name: string; code?: string | null }) {
  assertAdmin(ctx);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(subjects)
      .values({ academyId: ctx.academyId, name: input.name.trim(), code: input.code?.trim() || null })
      .returning();
    await logActivity(tx, ctx, { action: "subject.create", entityType: "subject", entityId: row!.id, summary: `Added subject ${row!.name}` });
    return row!;
  });
}

export async function updateSubject(ctx: Ctx, id: string, input: { name?: string; code?: string | null; archived?: boolean }) {
  assertAdmin(ctx);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(subjects)
      .set({
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { code: input.code?.trim() || null } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
      })
      .where(and(eq(subjects.id, id), eq(subjects.academyId, ctx.academyId)))
      .returning();
    if (!row) throw notFound("Subject");
    await logActivity(tx, ctx, { action: "subject.update", entityType: "subject", entityId: id, summary: `Updated subject ${row.name}`, after: input });
  });
}

// ─── Classes ────────────────────────────────────────────────────────────────
export type ClassRow = {
  id: string;
  name: string;
  shift: string | null;
  studentCount: number;
  subjectCount: number;
};

/** Sort order is derived from the name ("Grade 9 – A" → 9) — nobody types a level. */
export function levelFromName(name: string): number {
  const m = name.match(/\d{1,2}/);
  return m ? Math.min(99, Number(m[0])) : 0;
}

/** Current-year classes; teachers see only their own (SRS §5.2). */
export async function listClasses(ctx: Ctx): Promise<ClassRow[]> {
  const year = await requireCurrentYear(ctx.academyId);
  let scope: string[] | null = null;
  if (ctx.role === "teacher") scope = await teacherClassIds(ctx.userId, ctx.academyId);
  else if (!isStaffAdmin(ctx.role)) throw forbidden();
  if (scope && !scope.length) return [];

  return db
    .select({
      id: classes.id,
      name: classes.name,
      shift: classes.shift,
      studentCount: sql<number>`(select count(*)::int from ${enrollments} e where e.class_id = "classes"."id" and e.to_date is null)`,
      subjectCount: sql<number>`(select count(*)::int from ${classSubjects} cs where cs.class_id = "classes"."id" and cs.archived_at is null)`,
    })
    .from(classes)
    .where(and(eq(classes.academicYearId, year.id), isNull(classes.archivedAt), scope ? inArray(classes.id, scope) : undefined))
    .orderBy(asc(classes.level), asc(classes.name));
}

export type ClassInput = { name: string; shift?: string | null };

export async function createClass(ctx: Ctx, input: ClassInput & { subjectIds?: string[] }) {
  assertAdmin(ctx);
  const year = await requireCurrentYear(ctx.academyId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(classes)
      .values({
        academyId: ctx.academyId,
        academicYearId: year.id,
        name: input.name.trim(),
        level: levelFromName(input.name),
        shift: input.shift?.trim() || null,
      })
      .returning();
    if (input.subjectIds?.length) {
      await tx.insert(classSubjects).values(input.subjectIds.map((subjectId) => ({ classId: row!.id, subjectId })));
    }
    await logActivity(tx, ctx, { action: "class.create", entityType: "class", entityId: row!.id, summary: `Added class ${row!.name}` });
    return row!;
  });
}

export async function updateClass(ctx: Ctx, id: string, input: Partial<ClassInput>) {
  assertAdmin(ctx);
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(classes).where(and(eq(classes.id, id), eq(classes.academyId, ctx.academyId)));
    if (!before) throw notFound("Class");
    const [after] = await tx
      .update(classes)
      .set({
        ...(input.name !== undefined ? { name: input.name.trim(), level: levelFromName(input.name) } : {}),
        ...(input.shift !== undefined ? { shift: input.shift?.trim() || null } : {}),
        // No "class teacher" any more: teachers are assigned per subject only.
        classTeacherId: null,
      })
      .where(eq(classes.id, id))
      .returning();
    await logActivity(tx, ctx, {
      action: "class.update",
      entityType: "class",
      entityId: id,
      summary: `Updated class ${after!.name}`,
      before: { name: before.name, shift: before.shift },
      after: { name: after!.name, shift: after!.shift },
    });
  });
}

/** FR-ORG-07 / BR-ORG-03: archive only when no open enrollments. */
export async function archiveClass(ctx: Ctx, id: string) {
  assertAdmin(ctx);
  await db.transaction(async (tx) => {
    const [cls] = await tx.select().from(classes).where(and(eq(classes.id, id), eq(classes.academyId, ctx.academyId)));
    if (!cls) throw notFound("Class");
    const [{ n } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(enrollments)
      .where(and(eq(enrollments.classId, id), isNull(enrollments.toDate)));
    if (n > 0) {
      throw conflict("CLASS_HAS_STUDENTS", `${n} student${n === 1 ? " is" : "s are"} still in this class — move them first`, { count: n });
    }
    await tx.update(classes).set({ archivedAt: new Date() }).where(eq(classes.id, id));
    // Close open teacher assignments for the archived class.
    const csIds = (await tx.select({ id: classSubjects.id }).from(classSubjects).where(eq(classSubjects.classId, id))).map((r) => r.id);
    if (csIds.length) {
      await tx
        .update(classSubjectTeachers)
        .set({ toDate: todayPkt() })
        .where(and(inArray(classSubjectTeachers.classSubjectId, csIds), isNull(classSubjectTeachers.toDate)));
    }
    await logActivity(tx, ctx, { action: "class.archive", entityType: "class", entityId: id, summary: `Removed class ${cls.name}` });
  });
}

export type ClassSubjectRow = {
  id: string;
  subjectId: string;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
  studentCount: number;
};

export async function getClassDetail(ctx: Ctx, id: string) {
  if (ctx.role === "teacher") {
    if (!(await teacherClassIds(ctx.userId, ctx.academyId)).includes(id)) throw forbidden();
  } else if (!isStaffAdmin(ctx.role)) throw forbidden();

  const [cls] = await db
    .select({
      id: classes.id,
      name: classes.name,
      shift: classes.shift,
      archivedAt: classes.archivedAt,
      academicYearId: classes.academicYearId,
      studentCount: sql<number>`(select count(*)::int from ${enrollments} e where e.class_id = "classes"."id" and e.to_date is null)`,
    })
    .from(classes)
    .where(and(eq(classes.id, id), eq(classes.academyId, ctx.academyId)));
  if (!cls) throw notFound("Class");

  const subjectRows = await db
    .select({
      id: classSubjects.id,
      subjectId: subjects.id,
      subjectName: subjects.name,
      teacherId: classSubjectTeachers.teacherId,
      teacherName: users.name,
      studentCount: sql<number>`(
        select count(*)::int from ${enrollments} e
        where e.class_id = "class_subjects"."class_id" and e.to_date is null
          and not exists (select 1 from student_subject_exclusions x where x.enrollment_id = e.id and x.class_subject_id = "class_subjects"."id")
      )`,
    })
    .from(classSubjects)
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .leftJoin(classSubjectTeachers, and(eq(classSubjectTeachers.classSubjectId, classSubjects.id), isNull(classSubjectTeachers.toDate)))
    .leftJoin(users, eq(users.id, classSubjectTeachers.teacherId))
    .where(and(eq(classSubjects.classId, id), isNull(classSubjects.archivedAt)))
    .orderBy(asc(subjects.name));

  const mine = ctx.role === "teacher" ? new Set(await teacherClassSubjectIds(ctx.userId, ctx.academyId)) : null;
  return {
    ...cls,
    subjects: subjectRows.map((s) => ({ ...s, mine: mine ? mine.has(s.id) : true })) as (ClassSubjectRow & { mine: boolean })[],
  };
}

export async function addClassSubject(ctx: Ctx, classId: string, subjectId: string, teacherId?: string | null) {
  assertAdmin(ctx);
  await db.transaction(async (tx) => {
    const [cls] = await tx.select({ name: classes.name }).from(classes)
      .where(and(eq(classes.id, classId), eq(classes.academyId, ctx.academyId), isNull(classes.archivedAt))).for("update");
    if (!cls) throw notFound("Class");
    await assertAssignableSubject(tx, ctx, subjectId);
    if (teacherId) await assertActiveTeacher(tx, ctx, teacherId);
    await addSubjectToClass(tx, ctx, { id: classId, name: cls.name }, subjectId, teacherId);
  });
}

async function assertAssignableSubject(tx: Tx, ctx: Ctx, subjectId: string) {
  const [subject] = await tx.select({ id: subjects.id }).from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.academyId, ctx.academyId), isNull(subjects.archivedAt)));
  if (!subject) throw notFound("Subject");
}

async function assertActiveTeacher(tx: Tx, ctx: Ctx, teacherId: string) {
  const [teacher] = await tx.select({ id: users.id }).from(users)
    .innerJoin(roleAssignments, and(eq(roleAssignments.userId, users.id), eq(roleAssignments.role, "teacher"), eq(roleAssignments.active, true)))
    .where(and(eq(users.id, teacherId), eq(users.academyId, ctx.academyId), eq(users.status, "active")));
  if (!teacher) throw notFound("Active teacher");
}

async function addSubjectToClass(tx: Tx, ctx: Ctx, cls: { id: string; name: string }, subjectId: string, teacherId?: string | null) {
  const [row] = await tx.insert(classSubjects)
    .values({ classId: cls.id, subjectId })
    .onConflictDoUpdate({
      target: [classSubjects.classId, classSubjects.subjectId],
      set: { archivedAt: null },
      setWhere: sql`${classSubjects.archivedAt} is not null`,
    })
    .returning({ id: classSubjects.id });
  if (!row) throw conflict("DUPLICATE", "This subject is already in the class");
  await logActivity(tx, ctx, { action: "class_subject.add", entityType: "class_subject", entityId: row.id, summary: `Added subject to ${cls.name}` });
  if (teacherId) await changeSubjectTeacher(tx, ctx, row.id, teacherId);
}

export async function teacherAssignmentOptions(ctx: Ctx) {
  if (ctx.role !== "super_admin") throw forbidden();
  const [classList, subjectList] = await Promise.all([listClasses(ctx), listSubjects(ctx.academyId)]);
  const assignments = classList.length ? await db
    .select({ classId: classSubjects.classId, subjectId: classSubjects.subjectId, teacherId: classSubjectTeachers.teacherId, teacherName: users.name })
    .from(classSubjects)
    .leftJoin(classSubjectTeachers, and(eq(classSubjectTeachers.classSubjectId, classSubjects.id), isNull(classSubjectTeachers.toDate)))
    .leftJoin(users, eq(users.id, classSubjectTeachers.teacherId))
    .where(and(inArray(classSubjects.classId, classList.map((cls) => cls.id)), isNull(classSubjects.archivedAt))) : [];
  return {
    classes: classList.map(({ id, name, shift }) => ({ id, name, shift })),
    subjects: subjectList.map(({ id, name }) => ({ id, name })),
    assignments,
  };
}

export async function assignTeacherFromProfile(ctx: Ctx, teacherId: string, input: { classId: string; subjectId: string; previousTeacherId: string | null }) {
  if (ctx.role !== "super_admin") throw forbidden();
  const year = await requireCurrentYear(ctx.academyId);
  await db.transaction(async (tx) => {
    const [cls] = await tx.select({ id: classes.id, name: classes.name }).from(classes)
      .where(and(eq(classes.id, input.classId), eq(classes.academyId, ctx.academyId), eq(classes.academicYearId, year.id), isNull(classes.archivedAt)))
      .for("update");
    if (!cls) throw notFound("Current class");
    await assertAssignableSubject(tx, ctx, input.subjectId);
    await assertActiveTeacher(tx, ctx, teacherId);
    const [classSubject] = await tx.select({ id: classSubjects.id }).from(classSubjects)
      .where(and(eq(classSubjects.classId, cls.id), eq(classSubjects.subjectId, input.subjectId), isNull(classSubjects.archivedAt)))
      .for("update");
    if (classSubject) await changeSubjectTeacher(tx, ctx, classSubject.id, teacherId, input.previousTeacherId);
    else if (input.previousTeacherId) throw conflict("ASSIGNMENT_CHANGED", "The assignment changed. Close the form and refresh to try again.");
    else await addSubjectToClass(tx, ctx, cls, input.subjectId, teacherId);
  });
}

export async function removeClassSubject(ctx: Ctx, classSubjectId: string) {
  assertAdmin(ctx);
  await db.transaction(async (tx) => {
    await tx.update(classSubjects).set({ archivedAt: new Date() }).where(eq(classSubjects.id, classSubjectId));
    await tx
      .update(classSubjectTeachers)
      .set({ toDate: todayPkt() })
      .where(and(eq(classSubjectTeachers.classSubjectId, classSubjectId), isNull(classSubjectTeachers.toDate)));
    await logActivity(tx, ctx, { action: "class_subject.remove", entityType: "class_subject", entityId: classSubjectId, summary: "Removed a subject from a class" });
  });
}

/** BR-ORG-04: close the open assignment (to = yesterday) and open a new one from today. */
export async function assignTeacher(ctx: Ctx, classSubjectId: string, teacherId: string | null) {
  assertAdmin(ctx);
  await db.transaction(async (tx) => {
    const [classSubject] = await tx.select({ id: classSubjects.id }).from(classSubjects)
      .innerJoin(classes, eq(classes.id, classSubjects.classId))
      .where(and(eq(classSubjects.id, classSubjectId), eq(classes.academyId, ctx.academyId), isNull(classes.archivedAt), isNull(classSubjects.archivedAt)))
      .for("update", { of: classSubjects });
    if (!classSubject) throw notFound("Class subject");
    if (teacherId) await assertActiveTeacher(tx, ctx, teacherId);
    await changeSubjectTeacher(tx, ctx, classSubjectId, teacherId);
  });
}

async function changeSubjectTeacher(tx: Tx, ctx: Ctx, classSubjectId: string, teacherId: string | null, expectedTeacherId?: string | null) {
  const today = todayPkt();
  const [open] = await tx
    .select()
    .from(classSubjectTeachers)
    .where(and(eq(classSubjectTeachers.classSubjectId, classSubjectId), isNull(classSubjectTeachers.toDate)));
  const previous = open?.teacherId ?? null;
  if (previous === teacherId) return;
  if (expectedTeacherId !== undefined && previous !== expectedTeacherId) {
    throw conflict("ASSIGNMENT_CHANGED", "The assignment changed. Close the form and refresh to try again.");
  }
  if (open) {
    // Same-day reassignment: the old row would end before it started — just replace it.
    if (open.fromDate >= today) await tx.delete(classSubjectTeachers).where(eq(classSubjectTeachers.id, open.id));
    else await tx.update(classSubjectTeachers).set({ toDate: addDays(today, -1) }).where(eq(classSubjectTeachers.id, open.id));
  }
  if (teacherId) await tx.insert(classSubjectTeachers).values({ classSubjectId, teacherId, fromDate: today });
  await logActivity(tx, ctx, {
    action: "class_subject.assign_teacher",
    entityType: "class_subject",
    entityId: classSubjectId,
    summary: "Changed subject teacher",
    before: { teacherId: open?.teacherId ?? null },
    after: { teacherId },
  });
}

// ─── Academic year & holidays ───────────────────────────────────────────────
export async function listYears(academyId: string) {
  return db.select().from(academicYears).where(eq(academicYears.academyId, academyId)).orderBy(sql`${academicYears.startDate} desc`);
}

export async function updateYear(ctx: Ctx, yearId: string, input: { name?: string; startDate?: string; endDate?: string; workingDays?: number[] }) {
  assertAdmin(ctx);
  if (input.workingDays && !input.workingDays.length) throw badRequest("NO_WORKING_DAYS", "Pick at least one working day");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(academicYears)
      .set(input)
      .where(and(eq(academicYears.id, yearId), eq(academicYears.academyId, ctx.academyId)))
      .returning();
    if (!row) throw notFound("Academic year");
    await logActivity(tx, ctx, { action: "year.update", entityType: "academic_year", entityId: yearId, summary: `Updated academic year ${row.name}`, after: input });
  });
}

export async function listHolidays(academyId: string) {
  const year = await requireCurrentYear(academyId);
  return db.select().from(holidays).where(eq(holidays.academicYearId, year.id)).orderBy(asc(holidays.startDate));
}

export async function addHoliday(ctx: Ctx, input: { name: string; startDate: string; endDate: string }) {
  assertAdmin(ctx);
  if (input.endDate < input.startDate) throw badRequest("BAD_RANGE", "End date is before start date", { fields: { endDate: "End date is before start date" } });
  const year = await requireCurrentYear(ctx.academyId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(holidays)
      .values({ academyId: ctx.academyId, academicYearId: year.id, name: input.name.trim(), startDate: input.startDate, endDate: input.endDate })
      .returning();
    await logActivity(tx, ctx, { action: "holiday.create", entityType: "holiday", entityId: row!.id, summary: `Added holiday ${row!.name}` });
    return row!;
  });
}

export async function deleteHoliday(ctx: Ctx, id: string) {
  assertAdmin(ctx);
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(holidays).where(and(eq(holidays.id, id), eq(holidays.academyId, ctx.academyId))).returning();
    if (!row) throw notFound("Holiday");
    await logActivity(tx, ctx, { action: "holiday.delete", entityType: "holiday", entityId: id, summary: `Removed holiday ${row.name}`, before: row });
  });
}
