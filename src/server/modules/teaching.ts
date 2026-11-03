import "server-only";
/**
 * Daily teaching log — the whole "teaching progress" feature, kept simple:
 *
 *   A teacher writes, once per class-subject per day, what they taught and
 *   (optionally) the homework they gave — or marks "no class today".
 *   The office sees who logged, who missed days, and what is being taught.
 *   Parents see what their child was taught and the homework.
 *
 * Storage reuses existing tables, so no migration is needed:
 *   lesson_logs.note              → what was taught
 *   lesson_logs.no_lesson_reason  → "no class today" reason
 *   homework (linked by lesson_log_id, at most one per log) → homework text
 */
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  classes,
  classSubjects,
  classSubjectTeachers,
  enrollments,
  homework,
  lessonLogs,
  studentSubjectExclusions,
  subjects,
  users,
  type NoLessonReason,
} from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { addDays, holidayOn, isWorkingDay, lastWorkingDays, todayPkt, addWorkingDays, type ISODate } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { isStaffAdmin } from "@/lib/roles";
import { badRequest, forbidden, notFound } from "@/server/http";
import { assertStudentVisible, teacherClassSubjectIds } from "@/server/policy/scope";
import { getCurrentYear, requireCurrentYear } from "./academy";
import { logActivity } from "./audit";
import { parentsOf, queueNotifications } from "./notify";

export const NO_CLASS_REASONS: { value: NoLessonReason; label: string }[] = [
  { value: "test", label: "Test day" },
  { value: "revision", label: "Revision" },
  { value: "teacher_absent", label: "I was absent" },
  { value: "event", label: "Holiday / event" },
  { value: "other", label: "Other" },
];
export const noClassLabel = (r: NoLessonReason | null) => NO_CLASS_REASONS.find((x) => x.value === r)?.label ?? null;

/** Teachers may write or fix a log for today and the two days before (BR-TPR-13). */
export const editWindowOpen = (date: ISODate, today = todayPkt()) => date <= today && today <= addDays(date, 2);

export type DayLog = {
  id: string;
  date: ISODate;
  taught: string | null;
  noClassReason: NoLessonReason | null;
  homework: string | null;
  teacherName: string | null;
  updatedAt: Date;
};

// ─── Class-subjects in scope ────────────────────────────────────────────────
export type ClassSubjectRow = {
  id: string;
  classId: string;
  className: string;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
};

async function classSubjectsInScope(ctx: Ctx, f: { classId?: string; teacherId?: string; ids?: string[] } = {}): Promise<ClassSubjectRow[]> {
  const year = await getCurrentYear(ctx.academyId);
  if (!year) return [];
  if (f.ids && !f.ids.length) return [];
  return db
    .select({
      id: classSubjects.id,
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      teacherId: classSubjectTeachers.teacherId,
      teacherName: users.name,
    })
    .from(classSubjects)
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .leftJoin(classSubjectTeachers, and(eq(classSubjectTeachers.classSubjectId, classSubjects.id), isNull(classSubjectTeachers.toDate)))
    .leftJoin(users, eq(users.id, classSubjectTeachers.teacherId))
    .where(
      and(
        eq(classes.academicYearId, year.id),
        isNull(classes.archivedAt),
        isNull(classSubjects.archivedAt),
        f.ids ? inArray(classSubjects.id, f.ids) : undefined,
        f.classId ? eq(classes.id, f.classId) : undefined,
        f.teacherId ? eq(classSubjectTeachers.teacherId, f.teacherId) : undefined,
      ),
    )
    .orderBy(asc(classes.level), asc(classes.name), asc(subjects.name));
}

async function assertCanLog(ctx: Ctx, csId: string) {
  if (isStaffAdmin(ctx.role)) return;
  if (ctx.role === "teacher" && (await teacherClassSubjectIds(ctx.userId, ctx.academyId)).includes(csId)) return;
  throw forbidden();
}

export async function classSubjectInfo(ctx: Ctx, csId: string): Promise<ClassSubjectRow> {
  const [row] = await db
    .select({
      id: classSubjects.id,
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      teacherId: classSubjectTeachers.teacherId,
      teacherName: users.name,
    })
    .from(classSubjects)
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .leftJoin(classSubjectTeachers, and(eq(classSubjectTeachers.classSubjectId, classSubjects.id), isNull(classSubjectTeachers.toDate)))
    .leftJoin(users, eq(users.id, classSubjectTeachers.teacherId))
    .where(and(eq(classSubjects.id, csId), eq(classes.academyId, ctx.academyId)));
  if (!row) throw notFound("Class subject");
  return row;
}

/** Logs (with homework and author) for the given class-subjects in a date range — one query. */
async function logsFor(csIds: string[], from: ISODate, to: ISODate) {
  if (!csIds.length) return [];
  return db
    .select({
      id: lessonLogs.id,
      classSubjectId: lessonLogs.classSubjectId,
      teacherId: lessonLogs.teacherId,
      teacherName: users.name,
      date: lessonLogs.date,
      taught: lessonLogs.note,
      noClassReason: lessonLogs.noLessonReason,
      updatedAt: lessonLogs.updatedAt,
      homework: sql<string | null>`(select h.title from ${homework} h where h.lesson_log_id = ${lessonLogs.id} order by h.created_at desc limit 1)`,
    })
    .from(lessonLogs)
    .leftJoin(users, eq(users.id, lessonLogs.teacherId))
    .where(and(inArray(lessonLogs.classSubjectId, csIds), gte(lessonLogs.date, from), lte(lessonLogs.date, to)))
    .orderBy(desc(lessonLogs.date));
}

const toDayLog = (l: Awaited<ReturnType<typeof logsFor>>[number]): DayLog => ({
  id: l.id,
  date: l.date,
  taught: l.taught,
  noClassReason: l.noClassReason,
  homework: l.homework,
  teacherName: l.teacherName,
  updatedAt: l.updatedAt,
});

// ─── Write a log ────────────────────────────────────────────────────────────
export async function getDailyLog(ctx: Ctx, csId: string, date: ISODate) {
  await assertCanLog(ctx, csId);
  const today = todayPkt();
  const [info, recentRows] = await Promise.all([classSubjectInfo(ctx, csId), logsFor([csId], addDays(today, -60), today)]);
  const recent = recentRows.map(toDayLog);
  return {
    info,
    date,
    today,
    canEdit: isStaffAdmin(ctx.role) || editWindowOpen(date, today),
    log: recent.find((l) => l.date === date) ?? null,
    recent: recent.filter((l) => l.date !== date).slice(0, 10),
  };
}

export type DailyLogInput = {
  date: ISODate;
  taught?: string | null;
  homework?: string | null;
  noClassReason?: NoLessonReason | null;
  clientId?: string | null;
};

/** One log per class-subject per day (upsert). Notifies parents when homework is new or changed. */
export async function saveDailyLog(ctx: Ctx, csId: string, input: DailyLogInput) {
  await assertCanLog(ctx, csId);
  const today = todayPkt();
  if (input.date > today) throw badRequest("FUTURE_DATE", "You can't write a log for a future day");
  if (ctx.role === "teacher" && !editWindowOpen(input.date, today)) {
    throw forbidden("Logs can be written or changed for 2 days. Ask the office to change older ones.");
  }
  const noClass = input.noClassReason ?? null;
  const taught = noClass ? null : input.taught?.trim() || null;
  const hwText = noClass ? null : input.homework?.trim() || null;
  if (!noClass && !taught) throw badRequest("EMPTY_LOG", "Write what you taught, or choose “No class today”", { fields: { taught: "Write what you taught today" } });
  if (taught && taught.length > 2000) throw badRequest("TOO_LONG", "Keep it under 2000 characters", { fields: { taught: "Too long" } });

  const info = await classSubjectInfo(ctx, csId);
  const year = await getCurrentYear(ctx.academyId);

  return db.transaction(async (tx) => {
    if (input.clientId) {
      const [dupe] = await tx.select({ id: lessonLogs.id }).from(lessonLogs).where(eq(lessonLogs.clientId, input.clientId));
      if (dupe) return { id: dupe.id, duplicate: true, created: false };
    }
    const [existing] = await tx.select().from(lessonLogs).where(and(eq(lessonLogs.classSubjectId, csId), eq(lessonLogs.date, input.date)));
    let logId: string;
    if (existing) {
      await tx
        .update(lessonLogs)
        .set({ note: taught, noLessonReason: noClass, version: sql`${lessonLogs.version} + 1` })
        .where(eq(lessonLogs.id, existing.id));
      logId = existing.id;
    } else {
      const [n] = await tx
        .insert(lessonLogs)
        .values({ classSubjectId: csId, teacherId: info.teacherId ?? ctx.userId, date: input.date, note: taught, noLessonReason: noClass, clientId: input.clientId ?? null })
        .returning({ id: lessonLogs.id });
      logId = n!.id;
    }

    // Homework: at most one per log; replace when it changes.
    const [prevHw] = await tx.select({ id: homework.id, title: homework.title }).from(homework).where(eq(homework.lessonLogId, logId));
    const hwChanged = (prevHw?.title ?? null) !== hwText;
    if (hwChanged) {
      await tx.delete(homework).where(eq(homework.lessonLogId, logId));
      if (hwText) {
        const due = year ? addWorkingDays(year.calendar, input.date, 1) : addDays(input.date, 1);
        await tx.insert(homework).values({ classSubjectId: csId, lessonLogId: logId, title: hwText, dueDate: due, createdBy: ctx.userId });
        // Parents of students taking this subject.
        const takers = await tx
          .select({ id: enrollments.studentId })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.classId, info.classId),
              isNull(enrollments.toDate),
              sql`not exists (select 1 from ${studentSubjectExclusions} x where x.enrollment_id = ${enrollments.id} and x.class_subject_id = ${csId})`,
            ),
          );
        const parents = await parentsOf(tx, takers.map((t) => t.id));
        const recipients = [...new Set([...parents.values()].flat())];
        await queueNotifications(
          tx,
          recipients.map((userId) => ({
            userId,
            role: "parent" as const,
            type: "homework.posted",
            title: `${info.subjectName} homework`,
            body: hwText.length > 140 ? `${hwText.slice(0, 137)}…` : hwText,
            link: "/homework",
          })),
        );
      }
    }

    await logActivity(tx, ctx, {
      action: existing ? "lesson_log.edit" : "lesson_log.create",
      entityType: "lesson_log",
      entityId: logId,
      summary: `${existing ? "Updated" : "Wrote"} ${info.subjectName} log for ${info.className} · ${formatDate(input.date)}`,
      after: { noClass, homework: !!hwText },
    });
    return { id: logId, duplicate: false, created: !existing };
  });
}

// ─── Teacher: today + streak ────────────────────────────────────────────────
export async function teacherToday(ctx: Ctx) {
  if (ctx.role !== "teacher") throw forbidden();
  const today = todayPkt();
  const ids = await teacherClassSubjectIds(ctx.userId, ctx.academyId);
  const [items, year] = await Promise.all([classSubjectsInScope(ctx, { ids }), getCurrentYear(ctx.academyId)]);
  const cal = year?.calendar;
  const working = cal ? isWorkingDay(cal, today) : true;
  // Last 14 working days (including today when it is one) for the streak strip.
  const days = cal ? lastWorkingDays(cal, today, 14).reverse() : [today];
  const logs = await logsFor(ids, days[0] ?? today, today);
  const byDay = new Map<string, Set<string>>();
  for (const l of logs) byDay.set(l.date, (byDay.get(l.date) ?? new Set()).add(l.classSubjectId));
  const complete = (d: string) => ids.length > 0 && ids.every((id) => byDay.get(d)?.has(id));

  // Streak: consecutive complete working days, ending today (or yesterday while today is still open).
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]!;
    if (complete(d)) streak++;
    else if (d === today) continue;
    else break;
  }
  const todayLogs = new Map(logs.filter((l) => l.date === today).map((l) => [l.classSubjectId, toDayLog(l)]));
  return {
    today,
    isWorkingDay: working,
    holiday: cal ? holidayOn(cal, today)?.name ?? null : null,
    items: items.map((cs) => ({ ...cs, log: todayLogs.get(cs.id) ?? null })),
    streak,
    strip: days.slice(-10).map((d) => ({ date: d, done: complete(d), partial: !complete(d) && (byDay.get(d)?.size ?? 0) > 0 })),
  };
}

// ─── Office: one day across the academy ─────────────────────────────────────
export async function teachingDay(ctx: Ctx, date: ISODate, f: { classId?: string; teacherId?: string } = {}) {
  if (!isStaffAdmin(ctx.role)) throw forbidden();
  const year = await getCurrentYear(ctx.academyId);
  const rows = await classSubjectsInScope(ctx, f);
  const logs = await logsFor(rows.map((r) => r.id), date, date);
  const byCs = new Map(logs.map((l) => [l.classSubjectId, toDayLog(l)]));
  const items = rows.map((r) => ({ ...r, log: byCs.get(r.id) ?? null }));
  return {
    date,
    isWorkingDay: year ? isWorkingDay(year.calendar, date) : true,
    holiday: year ? holidayOn(year.calendar, date)?.name ?? null : null,
    items,
    logged: items.filter((i) => i.log).length,
    total: items.length,
  };
}

// ─── Office: who logs consistently ──────────────────────────────────────────
export type TeacherConsistency = {
  teacherId: string;
  teacherName: string;
  subjects: number;
  days: { date: ISODate; logged: number; expected: number }[];
  expected: number;
  logged: number;
  pct: number | null;
  missedDays: number;
  lastLog: ISODate | null;
};

/**
 * Per teacher over the last `count` working days (today excluded so a
 * teacher who hasn't logged *yet* today isn't counted as missing).
 */
export async function teacherConsistency(ctx: Ctx, opts: { count?: number; teacherId?: string } = {}): Promise<TeacherConsistency[]> {
  if (!isStaffAdmin(ctx.role) && !(ctx.role === "teacher" && opts.teacherId === ctx.userId)) throw forbidden();
  const year = await getCurrentYear(ctx.academyId);
  if (!year) return [];
  const today = todayPkt();
  const days = lastWorkingDays(year.calendar, addDays(today, -1), opts.count ?? 10).reverse();
  const rows = (await classSubjectsInScope({ ...ctx, role: "super_admin" } as Ctx, { teacherId: opts.teacherId })).filter((r) => r.teacherId);
  if (!rows.length) return [];
  const from = days[0] ?? today;
  const logs = await logsFor(rows.map((r) => r.id), from, today);

  const byTeacher = new Map<string, ClassSubjectRow[]>();
  for (const r of rows) byTeacher.set(r.teacherId!, [...(byTeacher.get(r.teacherId!) ?? []), r]);

  const out: TeacherConsistency[] = [];
  for (const [teacherId, list] of byTeacher) {
    const ids = new Set(list.map((l) => l.id));
    const mine = logs.filter((l) => ids.has(l.classSubjectId));
    const perDay = days.map((d) => ({ date: d, logged: mine.filter((l) => l.date === d).length, expected: list.length }));
    const expected = perDay.reduce((n, d) => n + d.expected, 0);
    const logged = perDay.reduce((n, d) => n + Math.min(d.logged, d.expected), 0);
    const lastLog = mine.reduce<string | null>((m, l) => (!m || l.date > m ? l.date : m), null);
    out.push({
      teacherId,
      teacherName: list[0]!.teacherName ?? "",
      subjects: list.length,
      days: perDay,
      expected,
      logged,
      pct: expected ? Math.round((logged / expected) * 100) : null,
      missedDays: perDay.filter((d) => d.logged === 0).length,
      lastLog,
    });
  }
  return out.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || a.teacherName.localeCompare(b.teacherName));
}

// ─── History for one class-subject ──────────────────────────────────────────
export async function classSubjectHistory(ctx: Ctx, csId: string, days = 45) {
  if (ctx.role === "parent") throw forbidden();
  await assertCanLog(ctx, csId);
  const today = todayPkt();
  const [info, logs] = await Promise.all([classSubjectInfo(ctx, csId), logsFor([csId], addDays(today, -days), today)]);
  return { info, logs: logs.map(toDayLog) };
}

/** A teacher's own recent logs across all their subjects (My log). */
export async function myRecentLogs(ctx: Ctx, days = 14) {
  if (ctx.role !== "teacher") throw forbidden();
  const ids = await teacherClassSubjectIds(ctx.userId, ctx.academyId);
  const today = todayPkt();
  const [rows, logs] = await Promise.all([classSubjectsInScope(ctx, { ids }), logsFor(ids, addDays(today, -days), today)]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return logs.map((l) => ({ ...toDayLog(l), classSubjectId: l.classSubjectId, subjectName: byId.get(l.classSubjectId)?.subjectName ?? "", className: byId.get(l.classSubjectId)?.className ?? "" }));
}

/** Office: one teacher's recent logs across their subjects. */
export async function teacherLogsForOffice(ctx: Ctx, teacherId: string, limit = 10) {
  if (!isStaffAdmin(ctx.role)) throw forbidden();
  const rows = await classSubjectsInScope(ctx, { teacherId });
  const today = todayPkt();
  const logs = await logsFor(rows.map((r) => r.id), addDays(today, -21), today);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return logs.slice(0, limit).map((l) => ({ ...toDayLog(l), classSubjectId: l.classSubjectId, subjectName: byId.get(l.classSubjectId)?.subjectName ?? "", className: byId.get(l.classSubjectId)?.className ?? "" }));
}

// ─── Parents ────────────────────────────────────────────────────────────────
/** What the child was taught in the last week, per subject, plus homework. */
export async function parentClassLog(ctx: Ctx, studentId: string, days = 7) {
  await assertStudentVisible(ctx, studentId);
  const [enr] = await db.select().from(enrollments).where(and(eq(enrollments.studentId, studentId), isNull(enrollments.toDate)));
  if (!enr) return { subjects: [] as ParentSubjectLog[] };
  await requireCurrentYear(ctx.academyId);
  const css = await db
    .select({ id: classSubjects.id, subjectName: subjects.name, teacherName: users.name })
    .from(classSubjects)
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .leftJoin(classSubjectTeachers, and(eq(classSubjectTeachers.classSubjectId, classSubjects.id), isNull(classSubjectTeachers.toDate)))
    .leftJoin(users, eq(users.id, classSubjectTeachers.teacherId))
    .where(
      and(
        eq(classSubjects.classId, enr.classId),
        isNull(classSubjects.archivedAt),
        sql`not exists (select 1 from ${studentSubjectExclusions} x where x.enrollment_id = ${enr.id} and x.class_subject_id = "class_subjects"."id")`,
      ),
    )
    .orderBy(asc(subjects.name));
  const today = todayPkt();
  const logs = await logsFor(css.map((c) => c.id), addDays(today, -days), today);
  return {
    subjects: css.map<ParentSubjectLog>((c) => ({
      classSubjectId: c.id,
      subjectName: c.subjectName,
      teacherName: c.teacherName,
      entries: logs.filter((l) => l.classSubjectId === c.id).map(toDayLog),
    })),
  };
}
export type ParentSubjectLog = { classSubjectId: string; subjectName: string; teacherName: string | null; entries: DayLog[] };

/** Homework for a child: recent and upcoming, newest first. */
export async function homeworkForStudent(ctx: Ctx, studentId: string, days = 21) {
  await assertStudentVisible(ctx, studentId);
  const [enr] = await db.select().from(enrollments).where(and(eq(enrollments.studentId, studentId), isNull(enrollments.toDate)));
  if (!enr) return [];
  const today = todayPkt();
  return db
    .select({ id: homework.id, text: homework.title, dueDate: homework.dueDate, givenOn: lessonLogs.date, subjectName: subjects.name })
    .from(homework)
    .innerJoin(classSubjects, eq(classSubjects.id, homework.classSubjectId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .leftJoin(lessonLogs, eq(lessonLogs.id, homework.lessonLogId))
    .where(
      and(
        eq(classSubjects.classId, enr.classId),
        gte(homework.dueDate, addDays(today, -days)),
        sql`not exists (select 1 from ${studentSubjectExclusions} x where x.enrollment_id = ${enr.id} and x.class_subject_id = ${homework.classSubjectId})`,
      ),
    )
    .orderBy(desc(homework.dueDate), asc(subjects.name));
}
