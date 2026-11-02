import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import {
  activityLog,
  classes,
  classSubjects,
  enrollments,
  feeRows,
  parentLinks,
  registrationCounters,
  studentSubjectExclusions,
  students,
  subjects,
  users,
  type RemovalReason,
} from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { addDays, monthStart, todayPkt } from "@/lib/dates";
import { isStaffAdmin } from "@/lib/roles";
import { normalizePhone } from "@/lib/phone";
import { badRequest, conflict, forbidden, notFound } from "@/server/http";
import { assertStudentVisible, parentStudentIds, teacherClassIds } from "@/server/policy/scope";
import { getSettings, requireCurrentYear } from "./academy";
import { logActivity } from "./audit";
import { ensureFeeRow, hasHistorySql, openEnrollment, unpaidMonths } from "./fee-rows";
import { ensureUserWithRole, type CreatedAccount } from "./users";

const assertAdmin = (ctx: Ctx) => {
  if (!isStaffAdmin(ctx.role)) throw forbidden();
};

// ─── Numbers ────────────────────────────────────────────────────────────────
/** BR-STU-01: <PREFIX>-<YY>-<NNNN>, per-year counter, gap-tolerant. */
async function nextRegistrationNo(tx: Tx, academyId: string, prefix: string, admissionDate: string): Promise<string> {
  const year = Number(admissionDate.slice(0, 4));
  const [row] = await tx
    .insert(registrationCounters)
    .values({ academyId, year, lastValue: 1 })
    .onConflictDoUpdate({
      target: [registrationCounters.academyId, registrationCounters.year],
      set: { lastValue: sql`${registrationCounters.lastValue} + 1` },
    })
    .returning({ n: registrationCounters.lastValue });
  return `${prefix}-${String(year).slice(2)}-${String(row!.n).padStart(4, "0")}`;
}

/** BR-STU-02: max numeric roll in class + 1. */
export async function suggestRollNo(tx: Tx, classId: string): Promise<string> {
  const [row] = await tx
    .select({ max: sql<number | null>`max(case when ${enrollments.rollNo} ~ '^[0-9]+$' then ${enrollments.rollNo}::int end)` })
    .from(enrollments)
    .where(and(eq(enrollments.classId, classId), isNull(enrollments.toDate)));
  return String((row?.max ?? 0) + 1);
}

async function assertRollFree(tx: Tx, classId: string, rollNo: string, exceptEnrollmentId?: string) {
  const [clash] = await tx
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.classId, classId),
        eq(enrollments.rollNo, rollNo),
        isNull(enrollments.toDate),
        exceptEnrollmentId ? ne(enrollments.id, exceptEnrollmentId) : undefined,
      ),
    );
  if (clash) throw badRequest("ROLL_TAKEN", `Roll no. ${rollNo} is already used in this class`, { fields: { rollNo: "Already used in this class" } });
}

/** Year is resolved by the caller *before* opening the transaction (never query `db` inside a tx). */
async function loadClassInYear(tx: Tx, ctx: Ctx, yearId: string, classId: string) {
  const [cls] = await tx
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.academyId, ctx.academyId), eq(classes.academicYearId, yearId), isNull(classes.archivedAt)));
  if (!cls) throw badRequest("BAD_CLASS", "Choose an active class", { fields: { classId: "Choose an active class" } });
  return cls;
}

// ─── Add ────────────────────────────────────────────────────────────────────
export type ParentInput = { phone: string; name?: string | null; relation: "father" | "mother" | "guardian" };
export type StudentInput = {
  name: string;
  guardianName: string;
  gender: "male" | "female" | "other";
  dob?: string | null;
  address?: string | null;
  notes?: string | null;
  admissionDate: string;
  classId: string;
  rollNo?: string | null;
  excludedClassSubjectIds?: string[];
  parents: ParentInput[];
};

async function linkParents(tx: Tx, ctx: Ctx, studentId: string, guardianName: string, parents: ParentInput[]): Promise<CreatedAccount[]> {
  const seen = new Set<string>();
  const out: CreatedAccount[] = [];
  for (const [i, p] of parents.entries()) {
    const phone = normalizePhone(p.phone);
    if (!phone) {
      throw badRequest("INVALID_PHONE", "Enter a valid Pakistani mobile number", { fields: { [`parents.${i}.phone`]: "Enter a valid Pakistani mobile number" } });
    }
    if (seen.has(phone)) continue;
    seen.add(phone);
    // BR-AUTH-02 / FR-STU-02: an existing phone links the existing account (siblings).
    const acc = await ensureUserWithRole(tx, ctx, { name: p.name?.trim() || guardianName, phone, role: "parent" });
    await tx.insert(parentLinks).values({ parentUserId: acc.userId, studentId, relation: p.relation }).onConflictDoNothing();
    out.push(acc);
  }
  const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(parentLinks).where(eq(parentLinks.studentId, studentId));
  if (n > 2) throw badRequest("TOO_MANY_PARENTS", "A student can have at most 2 parent accounts");
  return out;
}

async function setExclusions(tx: Tx, enrollmentId: string, classId: string, excluded: string[]) {
  await tx.delete(studentSubjectExclusions).where(eq(studentSubjectExclusions.enrollmentId, enrollmentId));
  if (!excluded.length) return;
  const valid = await tx
    .select({ id: classSubjects.id })
    .from(classSubjects)
    .where(and(eq(classSubjects.classId, classId), inArray(classSubjects.id, excluded)));
  if (valid.length) await tx.insert(studentSubjectExclusions).values(valid.map((v) => ({ enrollmentId, classSubjectId: v.id })));
}

/** BR-STU-03 — one transaction. Returns setup links for newly created parents. */
export async function addStudent(ctx: Ctx, input: StudentInput) {
  assertAdmin(ctx);
  if (!input.parents.length) throw badRequest("PARENT_REQUIRED", "Add at least one parent phone", { fields: { "parents.0.phone": "Add at least one parent phone" } });
  const [settings, year] = await Promise.all([getSettings(ctx.academyId), requireCurrentYear(ctx.academyId)]);
  const today = todayPkt();

  return db.transaction(async (tx) => {
    const cls = await loadClassInYear(tx, ctx, year.id, input.classId);
    const rollNo = input.rollNo?.trim() || (await suggestRollNo(tx, cls.id));
    await assertRollFree(tx, cls.id, rollNo);

    const registrationNo = await nextRegistrationNo(tx, ctx.academyId, settings.registrationPrefix, input.admissionDate);
    const [student] = await tx
      .insert(students)
      .values({
        academyId: ctx.academyId,
        registrationNo,
        name: input.name.trim(),
        guardianName: input.guardianName.trim(),
        gender: input.gender,
        dob: input.dob || null,
        address: input.address || null,
        notes: input.notes || null,
        admissionDate: input.admissionDate,
      })
      .returning();
    const s = student!;
    const [enr] = await tx
      .insert(enrollments)
      .values({ studentId: s.id, classId: cls.id, rollNo, fromDate: input.admissionDate })
      .returning();
    await setExclusions(tx, enr!.id, cls.id, input.excludedClassSubjectIds ?? []);
    const accounts = await linkParents(tx, ctx, s.id, s.guardianName, input.parents);

    if (settings.feeRowOnJoin && input.admissionDate <= today) {
      await ensureFeeRow(tx, ctx.academyId, s.id, cls.id, monthStart(today));
    }
    await logActivity(tx, ctx, {
      action: "student.add",
      entityType: "student",
      entityId: s.id,
      summary: `Added ${s.name} (${registrationNo}) to ${cls.name}`,
      after: { registrationNo, classId: cls.id, rollNo },
    });
    return {
      id: s.id,
      registrationNo,
      parents: accounts.map((a) => ({ name: a.name, phone: a.phone, setupLink: a.setupLink, created: a.created })),
    };
  });
}

// ─── Edit ───────────────────────────────────────────────────────────────────
export async function updateStudent(
  ctx: Ctx,
  id: string,
  input: Partial<Pick<StudentInput, "name" | "guardianName" | "gender" | "dob" | "address" | "notes" | "admissionDate">> & {
    rollNo?: string;
    excludedClassSubjectIds?: string[];
  },
) {
  assertAdmin(ctx);
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(students).where(and(eq(students.id, id), eq(students.academyId, ctx.academyId)));
    if (!before) throw notFound("Student");
    const patch = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.guardianName !== undefined ? { guardianName: input.guardianName.trim() } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.dob !== undefined ? { dob: input.dob || null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.admissionDate !== undefined ? { admissionDate: input.admissionDate } : {}),
    };
    if (Object.keys(patch).length) await tx.update(students).set(patch).where(eq(students.id, id));

    const enr = await openEnrollment(tx, id);
    if (enr && input.rollNo !== undefined && input.rollNo.trim() !== enr.rollNo) {
      await assertRollFree(tx, enr.classId, input.rollNo.trim(), enr.id);
      await tx.update(enrollments).set({ rollNo: input.rollNo.trim() }).where(eq(enrollments.id, enr.id));
    }
    if (enr && input.excludedClassSubjectIds) await setExclusions(tx, enr.id, enr.classId, input.excludedClassSubjectIds);

    await logActivity(tx, ctx, {
      action: "student.edit",
      entityType: "student",
      entityId: id,
      summary: `Edited ${before.name}`,
      before: Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof typeof before]])),
      after: { ...patch, ...(input.rollNo !== undefined ? { rollNo: input.rollNo } : {}) },
    });
  });
}

/** BR-STU-04 */
export async function moveStudent(ctx: Ctx, id: string, input: { classId: string; date: string; rollNo?: string | null }) {
  assertAdmin(ctx);
  const year = await requireCurrentYear(ctx.academyId);
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(students).where(and(eq(students.id, id), eq(students.academyId, ctx.academyId)));
    if (!s) throw notFound("Student");
    if (s.status !== "active") throw conflict("NOT_ACTIVE", "Re-admit the student before moving them");
    const cur = await openEnrollment(tx, id);
    if (!cur) throw conflict("NO_ENROLLMENT", "Student has no current class");
    if (cur.classId === input.classId) throw badRequest("SAME_CLASS", "Choose a different class", { fields: { classId: "Choose a different class" } });
    const cls = await loadClassInYear(tx, ctx, year.id, input.classId);
    const rollNo = input.rollNo?.trim() || (await suggestRollNo(tx, cls.id));
    await assertRollFree(tx, cls.id, rollNo);

    // Keep subject choices where the new class offers the same subject.
    const oldExcluded = await tx
      .select({ subjectId: classSubjects.subjectId })
      .from(studentSubjectExclusions)
      .innerJoin(classSubjects, eq(classSubjects.id, studentSubjectExclusions.classSubjectId))
      .where(eq(studentSubjectExclusions.enrollmentId, cur.id));

    let enrollmentId: string;
    if (cur.fromDate >= input.date) {
      // Moved on/before the day they joined → correct the enrollment instead of creating history.
      await tx.update(enrollments).set({ classId: cls.id, rollNo, fromDate: input.date }).where(eq(enrollments.id, cur.id));
      enrollmentId = cur.id;
    } else {
      await tx.update(enrollments).set({ toDate: addDays(input.date, -1) }).where(eq(enrollments.id, cur.id));
      const [n] = await tx.insert(enrollments).values({ studentId: id, classId: cls.id, rollNo, fromDate: input.date }).returning();
      enrollmentId = n!.id;
    }
    if (oldExcluded.length) {
      const mapped = await tx
        .select({ id: classSubjects.id })
        .from(classSubjects)
        .where(and(eq(classSubjects.classId, cls.id), inArray(classSubjects.subjectId, oldExcluded.map((e) => e.subjectId))));
      await setExclusions(tx, enrollmentId, cls.id, mapped.map((m) => m.id));
    } else {
      await setExclusions(tx, enrollmentId, cls.id, []);
    }
    await logActivity(tx, ctx, {
      action: "student.move",
      entityType: "student",
      entityId: id,
      summary: `Moved ${s.name} to ${cls.name}`,
      before: { classId: cur.classId, rollNo: cur.rollNo },
      after: { classId: cls.id, rollNo, from: input.date },
    });
    return { rollNo };
  });
}

/** BR-STU-05 */
export async function removeStudent(ctx: Ctx, id: string, input: { reason: RemovalReason; note?: string | null; date: string }) {
  assertAdmin(ctx);
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(students).where(and(eq(students.id, id), eq(students.academyId, ctx.academyId)));
    if (!s) throw notFound("Student");
    if (s.status === "removed") throw conflict("ALREADY_REMOVED", "Student is already removed");
    if (input.reason === "other" && !input.note?.trim()) throw badRequest("NOTE_REQUIRED", "Add a note for “Other”", { fields: { note: "Add a short note" } });
    const cur = await openEnrollment(tx, id);
    if (cur) await tx.update(enrollments).set({ toDate: input.date < cur.fromDate ? cur.fromDate : input.date }).where(eq(enrollments.id, cur.id));
    await tx
      .update(students)
      .set({ status: "removed", removedReason: input.reason, removedNote: input.note?.trim() || null, removedOn: input.date })
      .where(eq(students.id, id));
    const unpaid = await unpaidMonths(tx, id);
    await logActivity(tx, ctx, {
      action: "student.remove",
      entityType: "student",
      entityId: id,
      summary: `Removed ${s.name} (${input.reason})`,
      after: { reason: input.reason, date: input.date, unpaidMonths: unpaid.length },
      reason: input.note ?? null,
    });
    return { unpaidMonths: unpaid };
  });
}

/** BR-STU-06 */
export async function readmitStudent(ctx: Ctx, id: string, input: { classId: string; date: string; rollNo?: string | null }) {
  assertAdmin(ctx);
  const [settings, year] = await Promise.all([getSettings(ctx.academyId), requireCurrentYear(ctx.academyId)]);
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(students).where(and(eq(students.id, id), eq(students.academyId, ctx.academyId)));
    if (!s) throw notFound("Student");
    if (s.status === "active") throw conflict("ALREADY_ACTIVE", "Student is already active");
    const cls = await loadClassInYear(tx, ctx, year.id, input.classId);
    const rollNo = input.rollNo?.trim() || (await suggestRollNo(tx, cls.id));
    await assertRollFree(tx, cls.id, rollNo);
    await tx.update(students).set({ status: "active", removedReason: null, removedNote: null, removedOn: null }).where(eq(students.id, id));
    await tx.insert(enrollments).values({ studentId: id, classId: cls.id, rollNo, fromDate: input.date });
    const today = todayPkt();
    if (settings.feeRowOnJoin && input.date <= today) await ensureFeeRow(tx, ctx.academyId, id, cls.id, monthStart(today));
    await logActivity(tx, ctx, { action: "student.readmit", entityType: "student", entityId: id, summary: `Re-admitted ${s.name} to ${cls.name}`, after: { classId: cls.id, rollNo } });
  });
}

/** FR-STU-08: Super Admin only, only when there's no history. */
export async function deleteStudent(ctx: Ctx, id: string, confirmName: string) {
  if (ctx.role !== "super_admin") throw forbidden("Only the owner can permanently delete a student");
  await db.transaction(async (tx) => {
    const [s] = await tx
      .select({ id: students.id, name: students.name, reg: students.registrationNo, hasHistory: sql<boolean>`${hasHistorySql(id)}` })
      .from(students)
      .where(and(eq(students.id, id), eq(students.academyId, ctx.academyId)));
    if (!s) throw notFound("Student");
    if (s.hasHistory) throw conflict("HAS_HISTORY", "This student has attendance, marks or fee records — remove them instead of deleting");
    if (confirmName.trim().toLowerCase() !== s.name.trim().toLowerCase()) {
      throw badRequest("CONFIRM_MISMATCH", "Type the student's full name to confirm", { fields: { confirmName: "Name doesn't match" } });
    }
    await tx.delete(feeRows).where(eq(feeRows.studentId, id));
    await tx.delete(students).where(eq(students.id, id)); // cascades links, enrollments, exclusions
    await logActivity(tx, ctx, { action: "student.delete", entityType: "student", entityId: id, summary: `Permanently deleted ${s.name} (${s.reg})`, before: s });
  });
}

// ─── Parents on a student ───────────────────────────────────────────────────
export async function addParentToStudent(ctx: Ctx, studentId: string, parent: ParentInput) {
  assertAdmin(ctx);
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(students).where(and(eq(students.id, studentId), eq(students.academyId, ctx.academyId)));
    if (!s) throw notFound("Student");
    const [acc] = await linkParents(tx, ctx, studentId, s.guardianName, [parent]);
    if (!acc) throw badRequest("INVALID_PHONE", "Enter a valid Pakistani mobile number", { fields: { phone: "Enter a valid Pakistani mobile number" } });
    await logActivity(tx, ctx, { action: "student.parent_link", entityType: "student", entityId: studentId, summary: `Linked parent ${acc.name} to ${s.name}` });
    return { name: acc.name, phone: acc.phone, setupLink: acc.setupLink, created: acc.created };
  });
}

export async function unlinkParent(ctx: Ctx, studentId: string, parentUserId: string) {
  assertAdmin(ctx);
  await db.transaction(async (tx) => {
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(parentLinks).where(eq(parentLinks.studentId, studentId));
    if (n <= 1) throw conflict("LAST_PARENT", "A student needs at least one parent account");
    await tx.delete(parentLinks).where(and(eq(parentLinks.studentId, studentId), eq(parentLinks.parentUserId, parentUserId)));
    await logActivity(tx, ctx, { action: "student.parent_unlink", entityType: "student", entityId: studentId, summary: "Unlinked a parent account" });
  });
}

// ─── Read ───────────────────────────────────────────────────────────────────
export type StudentListItem = {
  id: string;
  name: string;
  registrationNo: string;
  guardianName: string;
  gender: string;
  status: "active" | "removed";
  classId: string | null;
  className: string | null;
  rollNo: string | null;
  parentPhone: string | null;
  feeStatus: "paid" | "unpaid" | "waived" | null;
};

export async function listStudents(
  ctx: Ctx,
  f: { q?: string; classId?: string; status?: "active" | "removed" | "all"; feeStatus?: "paid" | "unpaid"; limit?: number; offset?: number },
): Promise<{ items: StudentListItem[]; total: number }> {
  const conds: (SQL | undefined)[] = [eq(students.academyId, ctx.academyId)];
  if (ctx.role === "teacher") {
    const ids = await teacherClassIds(ctx.userId, ctx.academyId);
    if (!ids.length) return { items: [], total: 0 };
    conds.push(inArray(enrollments.classId, ids), eq(students.status, "active"));
  } else if (!isStaffAdmin(ctx.role)) throw forbidden();

  const status = f.status ?? "active";
  if (status !== "all" && ctx.role !== "teacher") conds.push(eq(students.status, status));
  if (f.classId) conds.push(eq(enrollments.classId, f.classId));
  const term = f.q?.trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    conds.push(
      or(
        ilike(students.name, `%${term}%`),
        ilike(students.registrationNo, `%${term}%`),
        eq(enrollments.rollNo, term),
        digits.length >= 4
          ? sql`exists (select 1 from ${parentLinks} pl join ${users} u on u.id = pl.parent_user_id where pl.student_id = "students"."id" and u.phone like ${"%" + digits.replace(/^0/, "") + "%"})`
          : undefined,
      ),
    );
  }
  const month = monthStart(todayPkt());
  const feeStatusSql = sql<"paid" | "unpaid" | "waived" | null>`(select fr.status from ${feeRows} fr where fr.student_id = "students"."id" and fr.month = ${month})`;
  if (f.feeStatus) conds.push(sql`${feeStatusSql} = ${f.feeStatus}`);

  // Latest enrollment (open, or the last one for removed students)
  const latestEnrollment = sql`${enrollments.id} = (select e2.id from ${enrollments} e2 where e2.student_id = "students"."id" order by e2.to_date is null desc, e2.from_date desc limit 1)`;
  const where = and(...conds);
  const base = db
    .select({
      id: students.id,
      name: students.name,
      registrationNo: students.registrationNo,
      guardianName: students.guardianName,
      gender: students.gender,
      status: students.status,
      classId: classes.id,
      className: classes.name,
      rollNo: enrollments.rollNo,
      parentPhone: sql<string | null>`(select u.phone from ${parentLinks} pl join ${users} u on u.id = pl.parent_user_id where pl.student_id = "students"."id" order by pl.created_at limit 1)`,
      feeStatus: feeStatusSql,
    })
    .from(students)
    .leftJoin(enrollments, latestEnrollment)
    .leftJoin(classes, eq(classes.id, enrollments.classId))
    .where(where);

  const [items, [totalRow]] = await Promise.all([
    base
      .orderBy(asc(classes.level), asc(classes.name), sql`case when ${enrollments.rollNo} ~ '^[0-9]+$' then lpad(${enrollments.rollNo}, 6, '0') else ${enrollments.rollNo} end`, asc(students.name))
      .limit(Math.min(f.limit ?? 50, 200))
      .offset(f.offset ?? 0),
    db
      .select({ n: count() })
      .from(students)
      .leftJoin(enrollments, latestEnrollment)
      .where(where),
  ]);
  return { items: items as StudentListItem[], total: totalRow?.n ?? 0 };
}

export async function getStudentProfile(ctx: Ctx, id: string) {
  await assertStudentVisible(ctx, id);
  const [s] = await db.select().from(students).where(and(eq(students.id, id), eq(students.academyId, ctx.academyId)));
  if (!s) throw notFound("Student");

  const history = await db
    .select({ id: enrollments.id, classId: classes.id, className: classes.name, rollNo: enrollments.rollNo, fromDate: enrollments.fromDate, toDate: enrollments.toDate })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(eq(enrollments.studentId, id))
    .orderBy(desc(enrollments.fromDate));
  const current = history.find((h) => h.toDate === null) ?? null;

  const parents = await db
    .select({ id: users.id, name: users.name, phone: users.phone, relation: parentLinks.relation, invited: sql<boolean>`${users.passwordHash} is null`, lastActiveAt: users.lastActiveAt })
    .from(parentLinks)
    .innerJoin(users, eq(users.id, parentLinks.parentUserId))
    .where(eq(parentLinks.studentId, id))
    .orderBy(asc(parentLinks.createdAt));

  const subjectRows = current
    ? await db
        .select({
          classSubjectId: classSubjects.id,
          name: subjects.name,
          excluded: sql<boolean>`exists (select 1 from ${studentSubjectExclusions} x where x.enrollment_id = ${current.id} and x.class_subject_id = "class_subjects"."id")`,
        })
        .from(classSubjects)
        .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
        .where(and(eq(classSubjects.classId, current.classId), isNull(classSubjects.archivedAt)))
        .orderBy(asc(subjects.name))
    : [];

  // SRS §5.4: teachers don't get notes/address/dob.
  const privateFields = ctx.role === "teacher" ? { dob: null, address: null, notes: null } : { dob: s.dob, address: s.address, notes: s.notes };
  let readOnly = false;
  if (ctx.role === "parent") readOnly = (await parentStudentIds(ctx.userId)).find((x) => x.id === id)?.readOnly ?? false;

  return {
    id: s.id,
    name: s.name,
    registrationNo: s.registrationNo,
    guardianName: s.guardianName,
    gender: s.gender,
    admissionDate: s.admissionDate,
    status: s.status,
    removedReason: s.removedReason,
    removedNote: s.removedNote,
    removedOn: s.removedOn,
    ...privateFields,
    current,
    history,
    parents: ctx.role === "parent" ? parents.filter((p) => p.id === ctx.userId) : parents,
    subjects: subjectRows,
    readOnly,
  };
}

export async function studentActivity(ctx: Ctx, id: string) {
  assertAdmin(ctx);
  return db
    .select({ id: activityLog.id, summary: activityLog.summary, at: activityLog.at, actorName: users.name, action: activityLog.action })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorId))
    .where(
      and(
        eq(activityLog.entityType, "student"),
        eq(activityLog.entityId, id),
        ctx.role === "admin" ? eq(activityLog.sensitivity, "normal") : undefined,
      ),
    )
    .orderBy(desc(activityLog.at))
    .limit(50);
}

/** Children of the signed-in parent, for the switcher. */
export async function myChildren(ctx: Ctx) {
  if (ctx.role !== "parent") throw forbidden();
  const ids = await parentStudentIds(ctx.userId);
  if (!ids.length) return [];
  const rows = await db
    .select({ id: students.id, name: students.name, status: students.status, className: classes.name, classId: classes.id, rollNo: enrollments.rollNo })
    .from(students)
    .leftJoin(enrollments, and(eq(enrollments.studentId, students.id), isNull(enrollments.toDate)))
    .leftJoin(classes, eq(classes.id, enrollments.classId))
    .where(inArray(students.id, ids.map((i) => i.id)))
    .orderBy(asc(students.name));
  return rows.map((r) => ({ ...r, readOnly: ids.find((i) => i.id === r.id)?.readOnly ?? false }));
}

