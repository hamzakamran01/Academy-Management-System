import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import {
  activityLog,
  assessments,
  classes,
  classSubjects,
  classSubjectTeachers,
  enrollments,
  examGroups,
  marks,
  roleAssignments,
  students,
  subjects,
  users,
  type AssessmentType,
} from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { rows as execRows } from "@/server/db/connect";
import { formatDate } from "@/lib/format";
import { classStats, fmtMark, gradeFor, markProblem, percentage, positions } from "@/lib/grades";
import { isStaffAdmin } from "@/lib/roles";
import { badRequest, conflict, forbidden, notFound } from "@/server/http";
import { assertStudentVisible, parentStudentIds, teacherClassSubjectIds } from "@/server/policy/scope";
import { getSettings, requireCurrentYear } from "./academy";
import { logActivity } from "./audit";
import { parentsOf, queueNotifications } from "./notify";

export const TYPE_LABEL: Record<AssessmentType, string> = {
  weekly: "Weekly test",
  monthly: "Monthly test",
  midterm: "Mid-term",
  final: "Final",
  other: "Test",
};

// ─── Scope helpers ──────────────────────────────────────────────────────────
async function assertCanEditCs(ctx: Ctx, classSubjectId: string) {
  if (isStaffAdmin(ctx.role)) return;
  if (ctx.role === "teacher" && (await teacherClassSubjectIds(ctx.userId, ctx.academyId)).includes(classSubjectId)) return;
  throw forbidden();
}

/** Class-subjects the user may create tests for (teacher: own; admin: all current-year). */
export async function classSubjectOptions(ctx: Ctx) {
  const year = await requireCurrentYear(ctx.academyId);
  let scope: string[] | null = null;
  if (ctx.role === "teacher") scope = await teacherClassSubjectIds(ctx.userId, ctx.academyId);
  else if (!isStaffAdmin(ctx.role)) throw forbidden();
  if (scope && !scope.length) return [];
  return db
    .select({ id: classSubjects.id, classId: classes.id, className: classes.name, subjectName: subjects.name })
    .from(classSubjects)
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .where(and(eq(classes.academicYearId, year.id), isNull(classes.archivedAt), isNull(classSubjects.archivedAt), scope ? inArray(classSubjects.id, scope) : undefined))
    .orderBy(asc(classes.level), asc(classes.name), asc(subjects.name));
}

/** BR-RES-01: students taking the subject whose enrollment covers the date. */
async function roster(tx: Tx, classSubjectId: string, classId: string, date: string) {
  return execRows<{ id: string; name: string; roll_no: string }>(
    tx as never,
    sql`select s.id, s.name, e.roll_no
        from enrollments e join students s on s.id = e.student_id
        where e.class_id = ${classId} and e.from_date <= ${date}::date and (e.to_date is null or e.to_date >= ${date}::date)
          and not exists (select 1 from student_subject_exclusions x where x.enrollment_id = e.id and x.class_subject_id = ${classSubjectId})
        order by case when e.roll_no ~ '^[0-9]+$' then lpad(e.roll_no, 6, '0') else e.roll_no end, s.name`,
  );
}

async function loadAssessment(tx: Tx, ctx: Ctx, id: string) {
  const [a] = await tx
    .select({
      a: assessments,
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(assessments)
    .innerJoin(classSubjects, eq(classSubjects.id, assessments.classSubjectId))
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .where(and(eq(assessments.id, id), eq(assessments.academyId, ctx.academyId)));
  if (!a) throw notFound("Test");
  return a;
}

// ─── Create / edit ──────────────────────────────────────────────────────────
export type AssessmentInput = { classSubjectId: string; type: AssessmentType; title?: string | null; date: string; totalMarks: number };

/** "Weekly test · 3 Nov" — used when the teacher leaves the name blank. */
export const autoTitle = (type: AssessmentType, date: string) => `${TYPE_LABEL[type]} · ${formatDate(date).replace(/,? \d{4}$/, "")}`;

export async function createAssessment(ctx: Ctx, input: AssessmentInput) {
  await assertCanEditCs(ctx, input.classSubjectId);
  if (markProblem(input.totalMarks, 1000) || input.totalMarks <= 0) throw badRequest("BAD_TOTAL", "Total marks must be a positive whole or half number", { fields: { totalMarks: "Enter a positive number" } });
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(assessments)
      .values({ academyId: ctx.academyId, classSubjectId: input.classSubjectId, type: input.type, title: input.title?.trim() || autoTitle(input.type, input.date), date: input.date, totalMarks: input.totalMarks, createdBy: ctx.userId })
      .returning();
    await logActivity(tx, ctx, { action: "assessment.create", entityType: "assessment", entityId: row!.id, summary: `Created test “${row!.title}”` });
    return { id: row!.id };
  });
}

export async function updateAssessment(ctx: Ctx, id: string, input: Partial<Omit<AssessmentInput, "classSubjectId">>) {
  const [peek] = await db.select({ cs: assessments.classSubjectId }).from(assessments).where(and(eq(assessments.id, id), eq(assessments.academyId, ctx.academyId)));
  if (!peek) throw notFound("Test");
  await assertCanEditCs(ctx, peek.cs);
  await db.transaction(async (tx) => {
    const { a } = await loadAssessment(tx, ctx, id);
    if (a.status === "published") throw conflict("LOCKED", "Published results are locked. Ask the office to unlock.");
    if (input.totalMarks !== undefined) {
      const [over] = await tx.select({ v: marks.value }).from(marks).where(and(eq(marks.assessmentId, id), gt(marks.value, input.totalMarks))).limit(1);
      if (over) throw badRequest("TOTAL_BELOW_MARKS", "Some marks are above the new total", { fields: { totalMarks: "Some marks are above this total" } });
    }
    await tx
      .update(assessments)
      .set({
        ...(input.title?.trim() ? { title: input.title.trim() } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.date ? { date: input.date } : {}),
        ...(input.totalMarks !== undefined ? { totalMarks: input.totalMarks } : {}),
        version: sql`${assessments.version} + 1`,
      })
      .where(eq(assessments.id, id));
    await logActivity(tx, ctx, { action: "assessment.update", entityType: "assessment", entityId: id, summary: `Edited test “${a.title}”`, after: input });
  });
}

export async function deleteDraftAssessment(ctx: Ctx, id: string) {
  const [peek] = await db.select({ cs: assessments.classSubjectId }).from(assessments).where(and(eq(assessments.id, id), eq(assessments.academyId, ctx.academyId)));
  if (!peek) throw notFound("Test");
  await assertCanEditCs(ctx, peek.cs);
  await db.transaction(async (tx) => {
    const { a } = await loadAssessment(tx, ctx, id);
    if (a.status !== "draft" || a.publishedAt) throw conflict("NOT_DRAFT", "Only never-published drafts can be deleted");
    await tx.delete(assessments).where(eq(assessments.id, id));
    await logActivity(tx, ctx, { action: "assessment.delete", entityType: "assessment", entityId: id, summary: `Deleted draft test “${a.title}”` });
  });
}

/** BR-RES-10: one draft per subject of the class, same type/title/date/total. */
export async function createExamGroup(ctx: Ctx, input: { classId: string; type: AssessmentType; title?: string | null; date: string; totalMarks: number }) {
  const title = input.title?.trim() || autoTitle(input.type, input.date);
  if (!isStaffAdmin(ctx.role)) throw forbidden();
  return db.transaction(async (tx) => {
    const [cls] = await tx.select({ name: classes.name }).from(classes).where(and(eq(classes.id, input.classId), eq(classes.academyId, ctx.academyId)));
    if (!cls) throw notFound("Class");
    const css = await tx.select({ id: classSubjects.id }).from(classSubjects).where(and(eq(classSubjects.classId, input.classId), isNull(classSubjects.archivedAt)));
    if (!css.length) throw badRequest("NO_SUBJECTS", "This class has no subjects yet");
    const [g] = await tx.insert(examGroups).values({ academyId: ctx.academyId, classId: input.classId, type: input.type, title, createdBy: ctx.userId }).returning();
    await tx.insert(assessments).values(
      css.map((cs) => ({ academyId: ctx.academyId, classSubjectId: cs.id, examGroupId: g!.id, type: input.type, title, date: input.date, totalMarks: input.totalMarks, createdBy: ctx.userId })),
    );
    await logActivity(tx, ctx, { action: "exam_group.create", entityType: "exam_group", entityId: g!.id, summary: `Created “${g!.title}” for ${cls.name} (${css.length} subjects)` });
    return { id: g!.id, tests: css.length };
  });
}

// ─── Lists ──────────────────────────────────────────────────────────────────
export async function listAssessments(ctx: Ctx, f: { classId?: string; status?: "draft" | "published" | "all" }) {
  const year = await requireCurrentYear(ctx.academyId);
  let scope: string[] | null = null;
  if (ctx.role === "teacher") scope = await teacherClassSubjectIds(ctx.userId, ctx.academyId);
  else if (!isStaffAdmin(ctx.role)) throw forbidden();
  if (scope && !scope.length) return [];
  const status = f.status ?? "all";
  return db
    .select({
      id: assessments.id,
      title: assessments.title,
      type: assessments.type,
      date: assessments.date,
      totalMarks: assessments.totalMarks,
      status: assessments.status,
      publishedAt: assessments.publishedAt,
      correctedAt: assessments.correctedAt,
      correctionRequestedAt: assessments.correctionRequestedAt,
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      entered: sql<number>`(select count(*)::int from ${marks} m where m.assessment_id = "assessments"."id")`,
    })
    .from(assessments)
    .innerJoin(classSubjects, eq(classSubjects.id, assessments.classSubjectId))
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .where(
      and(
        eq(classes.academicYearId, year.id),
        scope ? inArray(assessments.classSubjectId, scope) : undefined,
        f.classId ? eq(classes.id, f.classId) : undefined,
        status === "draft" ? or(eq(assessments.status, "draft"), eq(assessments.status, "unlocked")) : status === "published" ? eq(assessments.status, "published") : undefined,
      ),
    )
    .orderBy(desc(assessments.date), desc(assessments.createdAt))
    .limit(200);
}

// ─── Marks sheet ────────────────────────────────────────────────────────────
export async function getMarksSheet(ctx: Ctx, id: string) {
  const settings = await getSettings(ctx.academyId);
  const myCs = ctx.role === "teacher" ? await teacherClassSubjectIds(ctx.userId, ctx.academyId) : null;
  return db.transaction(async (tx) => {
    const { a, classId, className, subjectName } = await loadAssessment(tx, ctx, id);
    if (myCs && !myCs.includes(a.classSubjectId)) throw forbidden();
    if (!isStaffAdmin(ctx.role) && ctx.role !== "teacher") throw forbidden();
    const list = await roster(tx, a.classSubjectId, classId, a.date);
    const existing = await tx
      .select({ studentId: marks.studentId, value: marks.value, isAbsent: marks.isAbsent, name: students.name })
      .from(marks)
      .innerJoin(students, eq(students.id, marks.studentId))
      .where(eq(marks.assessmentId, id));
    const byId = new Map(existing.map((m) => [m.studentId, m]));
    const rosterIds = new Set(list.map((r) => r.id));
    const rows = [
      ...list.map((r) => ({ studentId: r.id, name: r.name, rollNo: r.roll_no, value: byId.get(r.id)?.value ?? null, isAbsent: byId.get(r.id)?.isAbsent ?? false })),
      // Marks for students no longer on the roster stay visible (history).
      ...existing.filter((m) => !rosterIds.has(m.studentId)).map((m) => ({ studentId: m.studentId, name: m.name, rollNo: "—", value: m.value, isAbsent: m.isAbsent })),
    ];
    const [teacher] = await tx
      .select({ name: users.name })
      .from(classSubjectTeachers)
      .innerJoin(users, eq(users.id, classSubjectTeachers.teacherId))
      .where(and(eq(classSubjectTeachers.classSubjectId, a.classSubjectId), isNull(classSubjectTeachers.toDate)));
    const editable = a.status !== "published";
    return {
      id: a.id,
      title: a.title,
      type: a.type,
      date: a.date,
      totalMarks: a.totalMarks,
      status: a.status,
      publishedAt: a.publishedAt,
      correctedAt: a.correctedAt,
      unlockReason: a.unlockReason,
      correctionRequestedAt: a.correctionRequestedAt,
      correctionRequestNote: a.correctionRequestNote,
      classSubjectId: a.classSubjectId,
      classId,
      className,
      subjectName,
      teacherName: teacher?.name ?? null,
      rows,
      stats: classStats(rows, a.totalMarks, settings.passPercent),
      passPercent: settings.passPercent,
      can: {
        edit: editable,
        publish: editable,
        unlock: a.status === "published" && isStaffAdmin(ctx.role),
        requestCorrection: a.status === "published" && ctx.role === "teacher",
        delete: a.status === "draft" && !a.publishedAt,
      },
    };
  });
}

export type MarkEntry = { studentId: string; value: number | null; absent: boolean };

/** BR-RES-02: valid rows saved, invalid rows reported per row (drafts allow partial). */
export async function saveMarks(ctx: Ctx, id: string, entries: MarkEntry[]) {
  const [peek] = await db.select({ cs: assessments.classSubjectId }).from(assessments).where(and(eq(assessments.id, id), eq(assessments.academyId, ctx.academyId)));
  if (!peek) throw notFound("Test");
  await assertCanEditCs(ctx, peek.cs);
  return db.transaction(async (tx) => {
    const { a, classId, subjectName } = await loadAssessment(tx, ctx, id);
    if (a.status === "published") throw conflict("LOCKED", "Published results are locked. Ask the office to unlock.");
    const allowed = new Set((await roster(tx, a.classSubjectId, classId, a.date)).map((r) => r.id));
    const existing = new Map((await tx.select().from(marks).where(eq(marks.assessmentId, id))).map((m) => [m.studentId, m]));
    const errors: { studentId: string; message: string }[] = [];
    let saved = 0;

    for (const e of entries) {
      if (!allowed.has(e.studentId) && !existing.has(e.studentId)) {
        errors.push({ studentId: e.studentId, message: "Not in this subject" });
        continue;
      }
      if (!e.absent && e.value != null) {
        const p = markProblem(e.value, a.totalMarks);
        if (p) {
          errors.push({ studentId: e.studentId, message: p });
          continue;
        }
      }
      const before = existing.get(e.studentId);
      const value = e.absent ? null : e.value;
      if (!e.absent && e.value == null) {
        if (before) await tx.delete(marks).where(eq(marks.id, before.id));
      } else {
        if (before && before.value === value && before.isAbsent === e.absent) continue;
        await tx
          .insert(marks)
          .values({ assessmentId: id, studentId: e.studentId, value, isAbsent: e.absent, updatedBy: ctx.userId })
          .onConflictDoUpdate({ target: [marks.assessmentId, marks.studentId], set: { value, isAbsent: e.absent, updatedBy: ctx.userId, updatedAt: new Date() } });
      }
      saved++;
      // FR-RES-05: corrections after unlock are logged old → new per mark.
      if (a.status === "unlocked") {
        await logActivity(tx, ctx, {
          action: "mark.correct",
          entityType: "assessment",
          entityId: id,
          summary: `Corrected ${subjectName} “${a.title}” mark`,
          before: { studentId: e.studentId, value: before?.value ?? null, absent: before?.isAbsent ?? false },
          after: { studentId: e.studentId, value, absent: e.absent },
          reason: a.unlockReason,
        });
      }
    }
    return { saved, errors };
  });
}

/** BR-RES-03/04/05: all students need a value or Absent; locks; notifies parents. */
export async function publishAssessment(ctx: Ctx, id: string) {
  const [peek] = await db.select({ cs: assessments.classSubjectId }).from(assessments).where(and(eq(assessments.id, id), eq(assessments.academyId, ctx.academyId)));
  if (!peek) throw notFound("Test");
  await assertCanEditCs(ctx, peek.cs);
  const settings = await getSettings(ctx.academyId);
  return db.transaction(async (tx) => {
    const { a, classId, subjectName } = await loadAssessment(tx, ctx, id);
    if (a.status === "published") return { status: "published" as const, notified: 0 };
    const list = await roster(tx, a.classSubjectId, classId, a.date);
    const have = new Map((await tx.select().from(marks).where(eq(marks.assessmentId, id))).map((m) => [m.studentId, m]));
    // Anyone left blank is recorded as Absent — publishing never gets stuck.
    const missing = list.filter((r) => !have.has(r.id)).map((r) => r.id);
    if (missing.length) {
      const filled = await tx
        .insert(marks)
        .values(missing.map((studentId) => ({ assessmentId: id, studentId, value: null, isAbsent: true, updatedBy: ctx.userId })))
        .onConflictDoNothing()
        .returning();
      for (const m of filled) have.set(m.studentId, m);
    }
    const correcting = a.status === "unlocked";
    const now = new Date();
    await tx
      .update(assessments)
      .set({
        status: "published",
        publishedAt: a.publishedAt ?? now,
        publishedBy: ctx.userId,
        correctedAt: correcting ? now : a.correctedAt,
        correctionRequestedAt: correcting ? null : a.correctionRequestedAt,
        version: sql`${assessments.version} + 1`,
      })
      .where(eq(assessments.id, id));

    // Who to notify: everyone on first publish; on republish only changed students.
    let targets = list.map((r) => r.id);
    if (correcting) {
      const [unlockEntry] = await tx
        .select({ at: activityLog.at })
        .from(activityLog)
        .where(and(eq(activityLog.entityType, "assessment"), eq(activityLog.entityId, id), eq(activityLog.action, "assessment.unlock")))
        .orderBy(desc(activityLog.at))
        .limit(1);
      const changed = await tx
        .select({ after: activityLog.after })
        .from(activityLog)
        .where(and(eq(activityLog.entityType, "assessment"), eq(activityLog.entityId, id), eq(activityLog.action, "mark.correct"), unlockEntry ? gt(activityLog.at, unlockEntry.at) : undefined));
      targets = [...new Set(changed.map((c) => (c.after as { studentId: string }).studentId))];
    }
    const parents = await parentsOf(tx, targets);
    const names = new Map(list.map((r) => [r.id, r.name]));
    const notes = [];
    for (const sid of targets) {
      const m = have.get(sid);
      const first = (names.get(sid) ?? "your child").split(" ")[0];
      const result = m?.isAbsent ? "Absent" : m?.value != null ? `${fmtMark(m.value)}/${fmtMark(a.totalMarks)} (${percentage(m.value, a.totalMarks)}%, ${gradeFor(percentage(m.value, a.totalMarks), settings.gradeScale)})` : "";
      for (const userId of parents.get(sid) ?? []) {
        notes.push({
          userId,
          role: "parent" as const,
          type: correcting ? "result.corrected" : "result.published",
          title: `${correcting ? "Corrected" : "New"} ${subjectName} result for ${first}`,
          body: `${subjectName} — ${a.title}: ${result}`,
          pushText: `${correcting ? "Corrected" : "New"} ${subjectName} result for ${first} — tap to view`,
          link: `/results?student=${sid}&test=${id}`,
        });
      }
    }
    await queueNotifications(tx, notes);
    await logActivity(tx, ctx, {
      action: correcting ? "assessment.republish" : "assessment.publish",
      entityType: "assessment",
      entityId: id,
      summary: `${correcting ? "Republished (corrected)" : "Published"} ${subjectName} “${a.title}”`,
      after: { notifiedParents: notes.length },
    });
    return { status: "published" as const, notified: notes.length };
  });
}

/** FR-RES-05: Admin / Super Admin, with reason. */
export async function unlockAssessment(ctx: Ctx, id: string, reason: string) {
  if (!isStaffAdmin(ctx.role)) throw forbidden();
  if (reason.trim().length < 3) throw badRequest("REASON_REQUIRED", "Give a reason", { fields: { reason: "Give a reason" } });
  await db.transaction(async (tx) => {
    const { a, subjectName } = await loadAssessment(tx, ctx, id);
    if (a.status !== "published") throw conflict("NOT_PUBLISHED", "Only published results can be unlocked");
    await tx.update(assessments).set({ status: "unlocked", unlockReason: reason.trim(), version: sql`${assessments.version} + 1` }).where(eq(assessments.id, id));
    await logActivity(tx, ctx, { action: "assessment.unlock", entityType: "assessment", entityId: id, summary: `Unlocked ${subjectName} “${a.title}”`, reason });
    // Let the subject teacher know they can correct it.
    const [t] = await tx
      .select({ id: classSubjectTeachers.teacherId })
      .from(classSubjectTeachers)
      .where(and(eq(classSubjectTeachers.classSubjectId, a.classSubjectId), isNull(classSubjectTeachers.toDate)));
    if (t) {
      await queueNotifications(tx, [
        { userId: t.id, role: "teacher", type: "result.unlocked", title: `${subjectName} “${a.title}” unlocked`, body: `Unlocked for correction: ${reason}`, link: `/results/${id}` },
      ]);
    }
  });
}

/** FR-RES-05: teacher asks the office to unlock. */
export async function requestCorrection(ctx: Ctx, id: string, note: string) {
  if (ctx.role !== "teacher") throw forbidden();
  await assertCanEditCs(ctx, (await db.select({ cs: assessments.classSubjectId }).from(assessments).where(eq(assessments.id, id)))[0]?.cs ?? "");
  await db.transaction(async (tx) => {
    const { a, subjectName, className } = await loadAssessment(tx, ctx, id);
    if (a.status !== "published") throw conflict("NOT_PUBLISHED", "This test isn't published");
    await tx.update(assessments).set({ correctionRequestedAt: new Date(), correctionRequestNote: note.trim() || null }).where(eq(assessments.id, id));
    const admins = await tx
      .select({ userId: roleAssignments.userId, role: roleAssignments.role })
      .from(roleAssignments)
      .innerJoin(users, eq(users.id, roleAssignments.userId))
      .where(and(eq(users.academyId, ctx.academyId), eq(roleAssignments.active, true), inArray(roleAssignments.role, ["admin", "super_admin"])));
    await queueNotifications(
      tx,
      admins.map((x) => ({
        userId: x.userId,
        role: x.role,
        type: "result.correction_request",
        title: `Correction requested · ${subjectName} ${className}`,
        body: `${ctx.name} asked to correct “${a.title}”${note.trim() ? `: ${note.trim()}` : ""}`,
        link: `/results/${id}`,
      })),
    );
    await logActivity(tx, ctx, { action: "assessment.correction_request", entityType: "assessment", entityId: id, summary: `Requested correction for “${a.title}”`, reason: note });
  });
}

// ─── Student / parent views ─────────────────────────────────────────────────
export type StudentResult = {
  assessmentId: string;
  subjectName: string;
  classSubjectId: string;
  title: string;
  type: AssessmentType;
  date: string;
  totalMarks: number;
  value: number | null;
  absent: boolean;
  pct: number | null;
  grade: string | null;
  classAverage: number | null;
  classAveragePct: number | null;
  position: number | null;
  outOf: number;
  corrected: boolean;
};

/** FR-RES-07/09: published results for one student, with per-subject summaries. */
export async function studentResults(ctx: Ctx, studentId: string) {
  await assertStudentVisible(ctx, studentId);
  const settings = await getSettings(ctx.academyId);
  const parent = ctx.role === "parent";
  const mine = await db
    .select({
      assessmentId: assessments.id,
      classSubjectId: assessments.classSubjectId,
      subjectName: subjects.name,
      title: assessments.title,
      type: assessments.type,
      date: assessments.date,
      totalMarks: assessments.totalMarks,
      correctedAt: assessments.correctedAt,
      value: marks.value,
      absent: marks.isAbsent,
    })
    .from(marks)
    .innerJoin(assessments, eq(assessments.id, marks.assessmentId))
    .innerJoin(classSubjects, eq(classSubjects.id, assessments.classSubjectId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .where(and(eq(marks.studentId, studentId), inArray(assessments.status, ["published", "unlocked"]), sql`${assessments.publishedAt} is not null`))
    .orderBy(desc(assessments.date));
  const ids = mine.map((m) => m.assessmentId);
  const all = ids.length
    ? await db.select({ assessmentId: marks.assessmentId, studentId: marks.studentId, value: marks.value, isAbsent: marks.isAbsent }).from(marks).where(inArray(marks.assessmentId, ids))
    : [];
  const showAvg = !parent || settings.showClassAverageToParents;
  const showPos = !parent || settings.showPositionToParents;

  const items: StudentResult[] = mine.map((m) => {
    const peers = all.filter((x) => x.assessmentId === m.assessmentId);
    const stats = classStats(peers, m.totalMarks, settings.passPercent);
    const pct = !m.absent && m.value != null ? percentage(m.value, m.totalMarks) : null;
    return {
      assessmentId: m.assessmentId,
      subjectName: m.subjectName,
      classSubjectId: m.classSubjectId,
      title: m.title,
      type: m.type,
      date: m.date,
      totalMarks: m.totalMarks,
      value: m.absent ? null : m.value,
      absent: m.absent,
      pct,
      grade: pct != null ? gradeFor(pct, settings.gradeScale) : null,
      classAverage: showAvg ? stats.average : null,
      classAveragePct: showAvg && stats.average != null ? percentage(stats.average, m.totalMarks) : null,
      position: showPos ? (positions(peers).get(studentId) ?? null) : null,
      outOf: stats.appeared,
      corrected: !!m.correctedAt,
    };
  });

  // BR-RES-09: subject average = mean of published percentages (absent excluded); overall = mean of subjects.
  const bySubject = new Map<string, StudentResult[]>();
  for (const r of items) bySubject.set(r.subjectName, [...(bySubject.get(r.subjectName) ?? []), r]);
  const subjectsSummary = [...bySubject.entries()]
    .map(([subjectName, rs]) => {
      const pcts = rs.filter((r) => r.pct != null).map((r) => r.pct!);
      const avg = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : null;
      return { subjectName, average: avg, grade: avg != null ? gradeFor(avg, settings.gradeScale) : null, count: rs.length, trend: [...rs].reverse().map((r) => ({ date: r.date, pct: r.pct })) };
    })
    .sort((x, y) => x.subjectName.localeCompare(y.subjectName));
  const subjAvgs = subjectsSummary.filter((s) => s.average != null).map((s) => s.average!);
  const overall = subjAvgs.length ? Math.round((subjAvgs.reduce((a, b) => a + b, 0) / subjAvgs.length) * 10) / 10 : null;
  return { items, subjects: subjectsSummary, overall, overallGrade: overall != null ? gradeFor(overall, settings.gradeScale) : null, showPosition: showPos };
}

/** Parent landing: their children with results. */
export async function parentChildrenIds(ctx: Ctx) {
  if (ctx.role !== "parent") throw forbidden();
  return parentStudentIds(ctx.userId);
}

// ─── Result sheets (FR-RES-10) ──────────────────────────────────────────────
export async function subjectResultSheet(ctx: Ctx, classSubjectId: string) {
  if (ctx.role === "teacher") await assertCanEditCs(ctx, classSubjectId);
  else if (!isStaffAdmin(ctx.role)) throw forbidden();
  const [info] = await db
    .select({ classId: classes.id, className: classes.name, subjectName: subjects.name })
    .from(classSubjects)
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .where(and(eq(classSubjects.id, classSubjectId), eq(classes.academyId, ctx.academyId)));
  if (!info) throw notFound("Class subject");
  const tests = await db
    .select({ id: assessments.id, title: assessments.title, date: assessments.date, totalMarks: assessments.totalMarks })
    .from(assessments)
    .where(and(eq(assessments.classSubjectId, classSubjectId), inArray(assessments.status, ["published", "unlocked"])))
    .orderBy(asc(assessments.date));
  const studentRows = await db
    .select({ id: students.id, name: students.name, rollNo: enrollments.rollNo })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.classId, info.classId), isNull(enrollments.toDate)))
    .orderBy(sql`case when ${enrollments.rollNo} ~ '^[0-9]+$' then lpad(${enrollments.rollNo}, 6, '0') else ${enrollments.rollNo} end`);
  const m = tests.length
    ? await db.select({ assessmentId: marks.assessmentId, studentId: marks.studentId, value: marks.value, isAbsent: marks.isAbsent }).from(marks).where(inArray(marks.assessmentId, tests.map((t) => t.id)))
    : [];
  return {
    ...info,
    tests,
    students: studentRows.map((s) => {
      const cells = tests.map((t) => m.find((x) => x.assessmentId === t.id && x.studentId === s.id) ?? null);
      const pcts = cells.map((c, i) => (c && !c.isAbsent && c.value != null ? percentage(c.value, tests[i]!.totalMarks) : null)).filter((p): p is number => p != null);
      return { ...s, cells: cells.map((c) => (c ? { value: c.value, absent: c.isAbsent } : null)), average: pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : null };
    }),
  };
}

export async function examGroupOptions(ctx: Ctx, classId?: string) {
  if (!isStaffAdmin(ctx.role)) return [];
  return db
    .select({ id: examGroups.id, title: examGroups.title, classId: examGroups.classId, className: classes.name })
    .from(examGroups)
    .innerJoin(classes, eq(classes.id, examGroups.classId))
    .where(and(eq(examGroups.academyId, ctx.academyId), classId ? eq(examGroups.classId, classId) : undefined))
    .orderBy(desc(examGroups.createdAt));
}
