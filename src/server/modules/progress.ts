import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, max, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import {
  books,
  chapters,
  classes,
  classSubjects,
  classSubjectTeachers,
  enrollments,
  homework,
  lessonLogs,
  lessonLogTopics,
  planComments,
  studentSubjectExclusions,
  subjects,
  topicProgress,
  topics,
  users,
  weeklyPlans,
  weeklyPlanTopics,
  type NoLessonReason,
} from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { addDays, todayPkt, weekStart as weekStartOf, type ISODate } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { computeProgress, planCompletion, type Progress } from "@/lib/progress";
import { isStaffAdmin } from "@/lib/roles";
import { badRequest, forbidden, notFound } from "@/server/http";
import { assertStudentVisible, teacherClassSubjectIds } from "@/server/policy/scope";
import { getSettings, requireCurrentYear, type CurrentYear } from "./academy";
import { logActivity } from "./audit";
import { parentsOf, queueNotifications } from "./notify";

// ─── Access ─────────────────────────────────────────────────────────────────
async function canTeach(ctx: Ctx, csId: string) {
  return isStaffAdmin(ctx.role) || (ctx.role === "teacher" && (await teacherClassSubjectIds(ctx.userId, ctx.academyId)).includes(csId));
}
async function assertTeach(ctx: Ctx, csId: string) {
  if (!(await canTeach(ctx, csId))) throw forbidden();
}
async function assertSyllabusEditor(ctx: Ctx, csId: string) {
  if (isStaffAdmin(ctx.role)) return;
  const s = await getSettings(ctx.academyId);
  if (ctx.role === "teacher" && s.teacherCanEditSyllabus && (await canTeach(ctx, csId))) return;
  throw forbidden("Only the office can edit the syllabus");
}

export async function classSubjectInfo(ctx: Ctx, csId: string) {
  const [row] = await db
    .select({ id: classSubjects.id, classId: classes.id, className: classes.name, subjectId: subjects.id, subjectName: subjects.name, teacherId: classSubjectTeachers.teacherId, teacherName: users.name })
    .from(classSubjects)
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .leftJoin(classSubjectTeachers, and(eq(classSubjectTeachers.classSubjectId, classSubjects.id), isNull(classSubjectTeachers.toDate)))
    .leftJoin(users, eq(users.id, classSubjectTeachers.teacherId))
    .where(and(eq(classSubjects.id, csId), eq(classes.academyId, ctx.academyId)));
  if (!row) throw notFound("Class subject");
  return row;
}

// ─── Syllabus ───────────────────────────────────────────────────────────────
export type SyllabusTopic = { id: string; title: string; size: number; status: "not_started" | "started" | "completed"; completedOn: string | null };
export type SyllabusChapter = { id: string; title: string; targetDate: string | null; topics: SyllabusTopic[] };
export type SyllabusBook = { id: string; title: string; chapters: SyllabusChapter[] };

async function loadTree(tx: Tx, csId: string): Promise<SyllabusBook[]> {
  const bs = await tx.select().from(books).where(and(eq(books.classSubjectId, csId), isNull(books.archivedAt))).orderBy(asc(books.order), asc(books.createdAt));
  if (!bs.length) return [];
  const cs = await tx.select().from(chapters).where(and(inArray(chapters.bookId, bs.map((b) => b.id)), isNull(chapters.archivedAt))).orderBy(asc(chapters.order), asc(chapters.createdAt));
  const ts = cs.length
    ? await tx
        .select({ t: topics, status: topicProgress.status, completedOn: topicProgress.completedOn })
        .from(topics)
        .leftJoin(topicProgress, and(eq(topicProgress.topicId, topics.id), eq(topicProgress.classSubjectId, csId)))
        .where(and(inArray(topics.chapterId, cs.map((c) => c.id)), isNull(topics.archivedAt)))
        .orderBy(asc(topics.order), asc(topics.createdAt))
    : [];
  return bs.map((b) => ({
    id: b.id,
    title: b.title,
    chapters: cs
      .filter((c) => c.bookId === b.id)
      .map((c) => ({
        id: c.id,
        title: c.title,
        targetDate: c.targetDate,
        topics: ts.filter((x) => x.t.chapterId === c.id).map((x) => ({ id: x.t.id, title: x.t.title, size: x.t.size, status: x.status ?? "not_started", completedOn: x.completedOn ?? null })),
      })),
  }));
}

export async function getSyllabus(ctx: Ctx, csId: string) {
  if (ctx.role === "parent") throw forbidden();
  await assertTeach(ctx, csId);
  return loadTree(db, csId);
}

export type SyllabusInput = {
  books: { id?: string; title: string; chapters: { id?: string; title: string; targetDate?: string | null; topics: { id?: string; title: string; size: number }[] }[] }[];
};

/**
 * FR-TPR-01: save the whole tree (ids keep existing rows; missing rows are
 * archived so teaching history is never lost).
 */
export async function saveSyllabus(ctx: Ctx, csId: string, input: SyllabusInput) {
  await assertSyllabusEditor(ctx, csId);
  const info = await classSubjectInfo(ctx, csId);
  await db.transaction(async (tx) => {
    const now = new Date();
    const existingBooks = await tx.select({ id: books.id }).from(books).where(and(eq(books.classSubjectId, csId), isNull(books.archivedAt)));
    const existingChapters = existingBooks.length ? await tx.select({ id: chapters.id }).from(chapters).where(and(inArray(chapters.bookId, existingBooks.map((b) => b.id)), isNull(chapters.archivedAt))) : [];
    const existingTopics = existingChapters.length ? await tx.select({ id: topics.id }).from(topics).where(and(inArray(topics.chapterId, existingChapters.map((c) => c.id)), isNull(topics.archivedAt))) : [];
    const keepB = new Set<string>(), keepC = new Set<string>(), keepT = new Set<string>();
    const ownB = new Set(existingBooks.map((b) => b.id)), ownC = new Set(existingChapters.map((c) => c.id)), ownT = new Set(existingTopics.map((t) => t.id));

    for (const [bi, b] of input.books.entries()) {
      let bookId = b.id && ownB.has(b.id) ? b.id : undefined;
      if (bookId) await tx.update(books).set({ title: b.title.trim(), order: bi }).where(eq(books.id, bookId));
      else bookId = (await tx.insert(books).values({ classSubjectId: csId, title: b.title.trim(), order: bi }).returning())[0]!.id;
      keepB.add(bookId);
      for (const [ci, c] of b.chapters.entries()) {
        let chapterId = c.id && ownC.has(c.id) ? c.id : undefined;
        if (chapterId) await tx.update(chapters).set({ bookId, title: c.title.trim(), order: ci, targetDate: c.targetDate || null }).where(eq(chapters.id, chapterId));
        else chapterId = (await tx.insert(chapters).values({ bookId, title: c.title.trim(), order: ci, targetDate: c.targetDate || null }).returning())[0]!.id;
        keepC.add(chapterId);
        for (const [ti, t] of c.topics.entries()) {
          const size = Math.max(1, Math.min(20, Math.round(t.size || 1)));
          if (t.id && ownT.has(t.id)) {
            await tx.update(topics).set({ chapterId, title: t.title.trim(), order: ti, size }).where(eq(topics.id, t.id));
            keepT.add(t.id);
          } else {
            const [nt] = await tx.insert(topics).values({ chapterId, title: t.title.trim(), order: ti, size }).returning();
            keepT.add(nt!.id);
          }
        }
      }
    }
    const goneT = existingTopics.filter((t) => !keepT.has(t.id)).map((t) => t.id);
    const goneC = existingChapters.filter((c) => !keepC.has(c.id)).map((c) => c.id);
    const goneB = existingBooks.filter((b) => !keepB.has(b.id)).map((b) => b.id);
    if (goneT.length) await tx.update(topics).set({ archivedAt: now }).where(inArray(topics.id, goneT));
    if (goneC.length) {
      await tx.update(chapters).set({ archivedAt: now }).where(inArray(chapters.id, goneC));
      await tx.update(topics).set({ archivedAt: now }).where(and(inArray(topics.chapterId, goneC), isNull(topics.archivedAt)));
    }
    if (goneB.length) await tx.update(books).set({ archivedAt: now }).where(inArray(books.id, goneB));
    await logActivity(tx, ctx, {
      action: "syllabus.save",
      entityType: "class_subject",
      entityId: csId,
      summary: `Updated ${info.subjectName} syllabus for ${info.className}`,
      after: { books: keepB.size, chapters: keepC.size, topics: keepT.size, archivedTopics: goneT.length },
    });
  });
}

/** FR-TPR-01: copy syllabus to other classes with the same subject (appends; keeps source links). */
export async function copySyllabus(ctx: Ctx, fromCsId: string, toCsIds: string[]) {
  if (!isStaffAdmin(ctx.role)) throw forbidden();
  const tree = await loadTree(db, fromCsId);
  if (!tree.length) throw badRequest("EMPTY", "This syllabus is empty");
  const info = await classSubjectInfo(ctx, fromCsId);
  await db.transaction(async (tx) => {
    const targets = await tx
      .select({ id: classSubjects.id })
      .from(classSubjects)
      .innerJoin(classes, eq(classes.id, classSubjects.classId))
      .where(and(inArray(classSubjects.id, toCsIds), eq(classSubjects.subjectId, info.subjectId), eq(classes.academyId, ctx.academyId), ne(classSubjects.id, fromCsId)));
    const srcTopicIds = tree.flatMap((b) => b.chapters.flatMap((c) => c.topics.map((t) => t.id)));
    const srcRoots = new Map(
      (await tx.select({ id: topics.id, source: topics.sourceTopicId }).from(topics).where(inArray(topics.id, srcTopicIds.length ? srcTopicIds : ["00000000-0000-0000-0000-000000000000"]))).map((r) => [r.id, r.source ?? r.id]),
    );
    for (const target of targets) {
      const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(books).where(and(eq(books.classSubjectId, target.id), isNull(books.archivedAt)));
      for (const [bi, b] of tree.entries()) {
        const [nb] = await tx.insert(books).values({ classSubjectId: target.id, title: b.title, order: n + bi }).returning();
        for (const [ci, c] of b.chapters.entries()) {
          const [nc] = await tx.insert(chapters).values({ bookId: nb!.id, title: c.title, order: ci, targetDate: c.targetDate }).returning();
          if (c.topics.length) {
            await tx.insert(topics).values(c.topics.map((t, ti) => ({ chapterId: nc!.id, title: t.title, order: ti, size: t.size, sourceTopicId: srcRoots.get(t.id) ?? t.id })));
          }
        }
      }
    }
    await logActivity(tx, ctx, { action: "syllabus.copy", entityType: "class_subject", entityId: fromCsId, summary: `Copied ${info.subjectName} syllabus to ${targets.length} class(es)` });
  });
}

/** Same-subject class-subjects the syllabus can be copied to. */
export async function sameSubjectTargets(ctx: Ctx, csId: string) {
  const info = await classSubjectInfo(ctx, csId);
  const year = await requireCurrentYear(ctx.academyId);
  return db
    .select({ id: classSubjects.id, className: classes.name })
    .from(classSubjects)
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .where(and(eq(classSubjects.subjectId, info.subjectId), ne(classSubjects.id, csId), eq(classes.academicYearId, year.id), isNull(classes.archivedAt), isNull(classSubjects.archivedAt)))
    .orderBy(asc(classes.level), asc(classes.name));
}

// ─── Topic progress (BR-TPR-01) ─────────────────────────────────────────────
async function recomputeTopics(tx: Tx, csId: string, topicIds: string[]) {
  if (!topicIds.length) return;
  const agg = await tx
    .select({
      topicId: lessonLogTopics.topicId,
      completedOn: sql<string | null>`min(${lessonLogs.date}) filter (where ${lessonLogTopics.status} = 'completed')`,
      started: sql<boolean>`bool_or(${lessonLogTopics.status} = 'started')`,
    })
    .from(lessonLogTopics)
    .innerJoin(lessonLogs, eq(lessonLogs.id, lessonLogTopics.lessonLogId))
    .where(and(eq(lessonLogs.classSubjectId, csId), inArray(lessonLogTopics.topicId, topicIds)))
    .groupBy(lessonLogTopics.topicId);
  for (const id of topicIds) {
    const a = agg.find((x) => x.topicId === id);
    const status = a?.completedOn ? "completed" : a?.started ? "started" : "not_started";
    await tx
      .insert(topicProgress)
      .values({ classSubjectId: csId, topicId: id, status, completedOn: a?.completedOn ?? null })
      .onConflictDoUpdate({ target: [topicProgress.classSubjectId, topicProgress.topicId], set: { status, completedOn: a?.completedOn ?? null, updatedAt: new Date() } });
  }
}

// ─── Lesson log ─────────────────────────────────────────────────────────────
/** BR-TPR-13: teachers may edit until date + 2 days, 23:59 PKT. */
export const editWindowOpen = (date: ISODate, today = todayPkt()) => today <= addDays(date, 2);

export async function getLessonLog(ctx: Ctx, csId: string, date: ISODate) {
  await assertTeach(ctx, csId);
  const [info, tree] = await Promise.all([classSubjectInfo(ctx, csId), loadTree(db, csId)]);
  const [log] = await db.select().from(lessonLogs).where(and(eq(lessonLogs.classSubjectId, csId), eq(lessonLogs.date, date)));
  const logged = log ? await db.select().from(lessonLogTopics).where(eq(lessonLogTopics.lessonLogId, log.id)) : [];
  const [plan] = await db.select({ id: weeklyPlans.id }).from(weeklyPlans).where(and(eq(weeklyPlans.classSubjectId, csId), eq(weeklyPlans.weekStart, weekStartOf(date))));
  const planned = plan ? (await db.select({ topicId: weeklyPlanTopics.topicId }).from(weeklyPlanTopics).where(eq(weeklyPlanTopics.weeklyPlanId, plan.id))).map((p) => p.topicId) : [];
  const hw = log ? await db.select().from(homework).where(eq(homework.lessonLogId, log.id)) : [];
  const flat = tree.flatMap((b) => b.chapters.flatMap((c) => c.topics.map((t) => ({ ...t, chapterTitle: c.title, bookTitle: b.title }))));
  // Two-tap pattern: this week's planned topics first, then the next not-completed ones in order.
  const suggestions = [
    ...flat.filter((t) => planned.includes(t.id)),
    ...flat.filter((t) => !planned.includes(t.id) && t.status !== "completed").slice(0, 6),
  ];
  return {
    info,
    date,
    canEdit: isStaffAdmin(ctx.role) || editWindowOpen(date),
    log: log ? { id: log.id, noLessonReason: log.noLessonReason, note: log.note, version: log.version, topics: logged.map((l) => ({ topicId: l.topicId, status: l.status, pages: l.pages })) } : null,
    homework: hw.map((h) => ({ id: h.id, title: h.title, details: h.details, dueDate: h.dueDate })),
    suggestions,
    plannedIds: planned,
    tree,
  };
}

export type LessonLogInput = {
  date: ISODate;
  topics: { topicId: string; status: "started" | "completed"; pages?: string | null }[];
  noLessonReason?: NoLessonReason | null;
  note?: string | null;
  homework?: { title: string; details?: string | null; dueDate: ISODate } | null;
  clientId?: string | null;
};

/** FR-TPR-05/06/07, BR-TPR-12/13/14 — one log per class-subject per day (upsert). */
export async function saveLessonLog(ctx: Ctx, csId: string, input: LessonLogInput) {
  await assertTeach(ctx, csId);
  if (ctx.role === "teacher" && !editWindowOpen(input.date)) throw forbidden("Lesson logs can be edited for 48 hours. Ask the office to change older logs.");
  if (input.date > todayPkt()) throw badRequest("FUTURE_DATE", "You can't log a future lesson");
  if (!input.noLessonReason && !input.topics.length) throw badRequest("EMPTY_LOG", "Tick at least one topic, or choose “No lesson today”");
  const info = await classSubjectInfo(ctx, csId);
  return db.transaction(async (tx) => {
    // Offline replay dedupe (BR-TPR-12)
    if (input.clientId) {
      const [dupe] = await tx.select({ id: lessonLogs.id }).from(lessonLogs).where(eq(lessonLogs.clientId, input.clientId));
      if (dupe) return { id: dupe.id, duplicate: true };
    }
    const validTopicIds = new Set(
      (await loadTree(tx, csId)).flatMap((b) => b.chapters.flatMap((c) => c.topics.map((t) => t.id))),
    );
    const chosen = input.noLessonReason ? [] : input.topics.filter((t) => validTopicIds.has(t.topicId));
    const [existing] = await tx.select().from(lessonLogs).where(and(eq(lessonLogs.classSubjectId, csId), eq(lessonLogs.date, input.date)));
    let logId: string;
    const before = existing ? (await tx.select({ topicId: lessonLogTopics.topicId }).from(lessonLogTopics).where(eq(lessonLogTopics.lessonLogId, existing.id))).map((x) => x.topicId) : [];
    if (existing) {
      await tx
        .update(lessonLogs)
        .set({ noLessonReason: input.noLessonReason ?? null, note: input.note ?? null, version: sql`${lessonLogs.version} + 1` })
        .where(eq(lessonLogs.id, existing.id));
      await tx.delete(lessonLogTopics).where(eq(lessonLogTopics.lessonLogId, existing.id));
      logId = existing.id;
    } else {
      const [n] = await tx
        .insert(lessonLogs)
        .values({ classSubjectId: csId, teacherId: info.teacherId ?? ctx.userId, date: input.date, noLessonReason: input.noLessonReason ?? null, note: input.note ?? null, clientId: input.clientId ?? null })
        .returning();
      logId = n!.id;
    }
    if (chosen.length) await tx.insert(lessonLogTopics).values(chosen.map((t) => ({ lessonLogId: logId, topicId: t.topicId, status: t.status, pages: t.pages || null })));
    await recomputeTopics(tx, csId, [...new Set([...before, ...chosen.map((t) => t.topicId)])]);

    let homeworkId: string | null = null;
    if (input.homework?.title.trim()) {
      const [hw] = await tx
        .insert(homework)
        .values({ classSubjectId: csId, lessonLogId: logId, title: input.homework.title.trim(), details: input.homework.details?.trim() || null, dueDate: input.homework.dueDate, createdBy: ctx.userId })
        .returning();
      homeworkId = hw!.id;
      // BR-TPR-14: parents of students taking the subject today.
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
          body: `${input.homework!.title.trim()} — due ${formatDate(input.homework!.dueDate)}`,
          link: "/homework",
        })),
      );
    }
    const late = ctx.role !== "teacher" && !editWindowOpen(input.date);
    await logActivity(tx, ctx, {
      action: existing ? "lesson_log.edit" : "lesson_log.create",
      entityType: "lesson_log",
      entityId: logId,
      summary: `${existing ? "Edited" : "Logged"} ${info.subjectName} lesson for ${info.className} on ${formatDate(input.date)}${late ? " (after edit window)" : ""}`,
      after: { topics: chosen.length, noLessonReason: input.noLessonReason ?? null, homework: !!homeworkId },
    });

    return { id: logId, duplicate: false, homeworkId };
  });
}

// ─── Weekly plan ────────────────────────────────────────────────────────────
function planDeadline(weekStartIso: ISODate, deadline: { weekday: number; time: string }): Date {
  const day = addDays(weekStartIso, deadline.weekday - 1);
  return new Date(`${day}T${deadline.time}:00+05:00`);
}

export async function getWeeklyPlan(ctx: Ctx, csId: string, week: ISODate) {
  if (ctx.role === "parent") throw forbidden();
  if (ctx.role === "teacher") await assertTeach(ctx, csId);
  const ws = weekStartOf(week);
  const [info, tree, settings] = await Promise.all([classSubjectInfo(ctx, csId), loadTree(db, csId), getSettings(ctx.academyId)]);
  const [plan] = await db.select().from(weeklyPlans).where(and(eq(weeklyPlans.classSubjectId, csId), eq(weeklyPlans.weekStart, ws)));
  const planTopics = plan ? (await db.select({ topicId: weeklyPlanTopics.topicId }).from(weeklyPlanTopics).where(eq(weeklyPlanTopics.weeklyPlanId, plan.id))).map((t) => t.topicId) : [];
  const comments = plan
    ? await db
        .select({ id: planComments.id, text: planComments.text, at: planComments.createdAt, authorName: users.name })
        .from(planComments)
        .innerJoin(users, eq(users.id, planComments.authorId))
        .where(eq(planComments.weeklyPlanId, plan.id))
        .orderBy(asc(planComments.createdAt))
    : [];
  // BR-TPR-11: carry forward last week's planned topics that aren't completed.
  const [prev] = await db.select({ id: weeklyPlans.id }).from(weeklyPlans).where(and(eq(weeklyPlans.classSubjectId, csId), eq(weeklyPlans.weekStart, addDays(ws, -7))));
  const prevTopics = prev ? (await db.select({ topicId: weeklyPlanTopics.topicId }).from(weeklyPlanTopics).where(eq(weeklyPlanTopics.weeklyPlanId, prev.id))).map((t) => t.topicId) : [];
  const status = new Map(tree.flatMap((b) => b.chapters.flatMap((c) => c.topics.map((t) => [t.id, t.status] as const))));
  const carryForward = prevTopics.filter((id) => status.get(id) !== "completed" && status.has(id));

  // Plan completion this week (BR-TPR-09)
  const completedThisWeek = new Set(
    (
      await db
        .select({ topicId: lessonLogTopics.topicId })
        .from(lessonLogTopics)
        .innerJoin(lessonLogs, eq(lessonLogs.id, lessonLogTopics.lessonLogId))
        .where(and(eq(lessonLogs.classSubjectId, csId), eq(lessonLogTopics.status, "completed"), gte(lessonLogs.date, ws), lte(lessonLogs.date, addDays(ws, 6))))
    ).map((r) => r.topicId),
  );
  const deadline = planDeadline(ws, settings.weeklyPlanDeadline);
  return {
    info,
    weekStart: ws,
    deadline,
    plan: plan ? { id: plan.id, status: plan.status, note: plan.note, submittedAt: plan.submittedAt, isLate: plan.isLate, topicIds: planTopics } : null,
    comments,
    carryForward,
    completion: planCompletion(planTopics, completedThisWeek),
    tree,
    canEdit: ctx.role === "teacher" || isStaffAdmin(ctx.role),
    canComment: isStaffAdmin(ctx.role),
  };
}

export async function saveWeeklyPlan(ctx: Ctx, csId: string, week: ISODate, input: { topicIds: string[]; note?: string | null; submit?: boolean }) {
  await assertTeach(ctx, csId);
  const ws = weekStartOf(week);
  const [info, settings] = await Promise.all([classSubjectInfo(ctx, csId), getSettings(ctx.academyId)]);
  return db.transaction(async (tx) => {
    const valid = new Set((await loadTree(tx, csId)).flatMap((b) => b.chapters.flatMap((c) => c.topics.map((t) => t.id))));
    const ids = [...new Set(input.topicIds.filter((id) => valid.has(id)))];
    let [plan] = await tx.select().from(weeklyPlans).where(and(eq(weeklyPlans.classSubjectId, csId), eq(weeklyPlans.weekStart, ws)));
    if (!plan) [plan] = await tx.insert(weeklyPlans).values({ classSubjectId: csId, teacherId: info.teacherId ?? ctx.userId, weekStart: ws, note: input.note ?? null }).returning();
    else await tx.update(weeklyPlans).set({ note: input.note ?? null }).where(eq(weeklyPlans.id, plan.id));
    await tx.delete(weeklyPlanTopics).where(eq(weeklyPlanTopics.weeklyPlanId, plan!.id));
    if (ids.length) await tx.insert(weeklyPlanTopics).values(ids.map((topicId) => ({ weeklyPlanId: plan!.id, topicId })));
    if (input.submit && plan!.status !== "submitted") {
      const now = new Date();
      await tx.update(weeklyPlans).set({ status: "submitted", submittedAt: now, isLate: now > planDeadline(ws, settings.weeklyPlanDeadline) }).where(eq(weeklyPlans.id, plan!.id));
      await logActivity(tx, ctx, { action: "weekly_plan.submit", entityType: "weekly_plan", entityId: plan!.id, summary: `Submitted ${info.subjectName} plan for ${info.className}, week of ${formatDate(ws)}` });
    }
    return { id: plan!.id };
  });
}

/** BR-TPR-10: copy to another class of the same subject (match by source topic, else titles). */
export async function copyPlanTo(ctx: Ctx, planId: string, targetCsIds: string[]) {
  const [plan] = await db.select().from(weeklyPlans).where(eq(weeklyPlans.id, planId));
  if (!plan) throw notFound("Plan");
  await assertTeach(ctx, plan.classSubjectId);
  const src = await db
    .select({ id: topics.id, title: topics.title, source: topics.sourceTopicId, chapterTitle: chapters.title })
    .from(weeklyPlanTopics)
    .innerJoin(topics, eq(topics.id, weeklyPlanTopics.topicId))
    .innerJoin(chapters, eq(chapters.id, topics.chapterId))
    .where(eq(weeklyPlanTopics.weeklyPlanId, planId));
  const results: { classSubjectId: string; matched: number; unmatched: string[] }[] = [];
  for (const cs of targetCsIds) {
    if (!(await canTeach(ctx, cs))) continue;
    const tree = await loadTree(db, cs);
    const flat = tree.flatMap((b) => b.chapters.flatMap((c) => c.topics.map((t) => ({ id: t.id, title: t.title, chapterTitle: c.title }))));
    const srcIds = flat.length
      ? new Map((await db.select({ id: topics.id, source: topics.sourceTopicId }).from(topics).where(inArray(topics.id, flat.map((f) => f.id)))).map((r) => [r.id, r.source]))
      : new Map<string, string | null>();
    const matched: string[] = [];
    const unmatched: string[] = [];
    for (const t of src) {
      const root = t.source ?? t.id;
      const hit = flat.find((f) => srcIds.get(f.id) === root || f.id === root) ?? flat.find((f) => f.title === t.title && f.chapterTitle === t.chapterTitle);
      if (hit) matched.push(hit.id);
      else unmatched.push(t.title);
    }
    await saveWeeklyPlan(ctx, cs, plan.weekStart, { topicIds: matched, note: plan.note });
    results.push({ classSubjectId: cs, matched: matched.length, unmatched });
  }
  return results;
}

export async function addPlanComment(ctx: Ctx, planId: string, text: string) {
  if (!isStaffAdmin(ctx.role)) throw forbidden();
  if (!text.trim()) throw badRequest("EMPTY", "Write a comment");
  await db.transaction(async (tx) => {
    const [plan] = await tx.select().from(weeklyPlans).where(eq(weeklyPlans.id, planId));
    if (!plan) throw notFound("Plan");
    await tx.insert(planComments).values({ weeklyPlanId: planId, authorId: ctx.userId, text: text.trim() });
    await queueNotifications(tx, [
      { userId: plan.teacherId, role: "teacher", type: "plan.comment", title: "New comment on your weekly plan", body: `${ctx.name}: ${text.trim()}`, link: `/plans/${plan.classSubjectId}?week=${plan.weekStart}` },
    ]);
  });
}

// ─── Progress views ─────────────────────────────────────────────────────────
async function progressFor(csId: string, year: CurrentYear, thresholds: { atRisk: number; behind: number }, today: ISODate) {
  const tree = await loadTree(db, csId);
  const chs = tree.flatMap((b) => b.chapters);
  const progress = computeProgress({
    chapters: chs.map((c) => ({ id: c.id, targetDate: c.targetDate })),
    topics: chs.flatMap((c) => c.topics.map((t) => ({ chapterId: c.id, size: t.size, status: t.status, completedOn: t.completedOn }))),
    cal: year.calendar,
    today,
    thresholds,
  });
  return { tree, progress };
}

export type ClassSubjectProgress = {
  info: Awaited<ReturnType<typeof classSubjectInfo>>;
  progress: Progress;
  tree: SyllabusBook[];
  lastLog: string | null;
  completedThisWeek: number;
  upcomingTargets: { title: string; targetDate: string }[];
};

/** FR-TPR-08/09 for one class-subject. */
export async function classSubjectProgress(ctx: Ctx, csId: string): Promise<ClassSubjectProgress> {
  if (ctx.role === "parent") throw forbidden();
  await assertTeach(ctx, csId);
  const [info, year, settings] = await Promise.all([classSubjectInfo(ctx, csId), requireCurrentYear(ctx.academyId), getSettings(ctx.academyId)]);
  const today = todayPkt();
  const { tree, progress } = await progressFor(csId, year, settings.progressThresholds, today);
  const [last] = await db.select({ d: max(lessonLogs.date) }).from(lessonLogs).where(eq(lessonLogs.classSubjectId, csId));
  const ws = weekStartOf(today);
  const doneWeek = tree.flatMap((b) => b.chapters.flatMap((c) => c.topics)).filter((t) => t.status === "completed" && t.completedOn && t.completedOn >= ws).length;
  const upcoming = tree
    .flatMap((b) => b.chapters)
    .filter((c) => c.targetDate && c.targetDate >= today && c.topics.some((t) => t.status !== "completed"))
    .slice(0, 3)
    .map((c) => ({ title: c.title, targetDate: c.targetDate! }));
  return { info, progress, tree, lastLog: last?.d ?? null, completedThisWeek: doneWeek, upcomingTargets: upcoming };
}

/** FR-TPR-11: all class-subjects with coverage, expected, status, last log, plan this week. */
export async function progressDashboard(ctx: Ctx, f: { classId?: string; teacherId?: string } = {}) {
  let scope: string[] | null = null;
  if (ctx.role === "teacher") scope = await teacherClassSubjectIds(ctx.userId, ctx.academyId);
  else if (!isStaffAdmin(ctx.role)) throw forbidden();
  const [year, settings] = await Promise.all([requireCurrentYear(ctx.academyId), getSettings(ctx.academyId)]);
  const today = todayPkt();
  const ws = weekStartOf(today);
  const rows = await db
    .select({
      id: classSubjects.id,
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      teacherId: classSubjectTeachers.teacherId,
      teacherName: users.name,
      lastLog: sql<string | null>`(select max(l.date)::text from ${lessonLogs} l where l.class_subject_id = "class_subjects"."id")`,
      planStatus: sql<string | null>`(select p.status::text from ${weeklyPlans} p where p.class_subject_id = "class_subjects"."id" and p.week_start = ${ws}::date)`,
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
        scope ? inArray(classSubjects.id, scope.length ? scope : ["00000000-0000-0000-0000-000000000000"]) : undefined,
        f.classId ? eq(classes.id, f.classId) : undefined,
        f.teacherId ? eq(classSubjectTeachers.teacherId, f.teacherId) : undefined,
      ),
    )
    .orderBy(asc(classes.level), asc(classes.name), asc(subjects.name));
  const out = [];
  for (const r of rows) {
    const { progress } = await progressFor(r.id, year, settings.progressThresholds, today);
    out.push({ ...r, progress });
  }
  return out;
}

// ─── Parent views (FR-TPR-10, P-04, P-05) ───────────────────────────────────
export async function parentProgress(ctx: Ctx, studentId: string) {
  await assertStudentVisible(ctx, studentId);
  const [year, settings] = await Promise.all([requireCurrentYear(ctx.academyId), getSettings(ctx.academyId)]);
  const today = todayPkt();
  const ws = weekStartOf(today);
  const [enr] = await db.select().from(enrollments).where(and(eq(enrollments.studentId, studentId), isNull(enrollments.toDate)));
  if (!enr) return { subjects: [] };
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
  const out = [];
  for (const cs of css) {
    const { tree, progress } = await progressFor(cs.id, year, settings.progressThresholds, today);
    const taught = await db
      .select({ title: topics.title, status: lessonLogTopics.status, date: lessonLogs.date })
      .from(lessonLogTopics)
      .innerJoin(lessonLogs, eq(lessonLogs.id, lessonLogTopics.lessonLogId))
      .innerJoin(topics, eq(topics.id, lessonLogTopics.topicId))
      .where(and(eq(lessonLogs.classSubjectId, cs.id), gte(lessonLogs.date, ws), lte(lessonLogs.date, today)))
      .orderBy(asc(lessonLogs.date));
    const hw = await db
      .select({ id: homework.id, title: homework.title, details: homework.details, dueDate: homework.dueDate })
      .from(homework)
      .where(and(eq(homework.classSubjectId, cs.id), gte(homework.dueDate, addDays(today, -1))))
      .orderBy(asc(homework.dueDate))
      .limit(5);
    const completedChapters = tree.flatMap((b) => b.chapters).filter((c) => c.topics.length && c.topics.every((t) => t.status === "completed")).map((c) => c.title);
    out.push({
      classSubjectId: cs.id,
      subjectName: cs.subjectName,
      teacherName: cs.teacherName,
      coverage: progress.coverage,
      status: settings.showProgressStatusToParents ? progress.status : null,
      thisWeek: taught,
      homework: hw,
      completedChapters,
      totalChapters: tree.flatMap((b) => b.chapters).filter((c) => c.topics.length).length,
    });
  }
  return { subjects: out };
}

/** Teacher "Today" helper: class-subjects with today's log state. */
export async function myTeachingToday(ctx: Ctx) {
  if (ctx.role !== "teacher") throw forbidden();
  const ids = await teacherClassSubjectIds(ctx.userId, ctx.academyId);
  if (!ids.length) return [];
  const today = todayPkt();
  return db
    .select({
      id: classSubjects.id,
      className: classes.name,
      classId: classes.id,
      subjectName: subjects.name,
      loggedToday: sql<boolean>`exists (select 1 from ${lessonLogs} l where l.class_subject_id = "class_subjects"."id" and l.date = ${today}::date)`,
      planStatus: sql<string | null>`(select p.status::text from ${weeklyPlans} p where p.class_subject_id = "class_subjects"."id" and p.week_start = ${weekStartOf(today)}::date)`,
    })
    .from(classSubjects)
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .where(inArray(classSubjects.id, ids))
    .orderBy(asc(classes.level), asc(classes.name), asc(subjects.name));
}

export async function recentLogs(ctx: Ctx, csId: string, limit = 10) {
  await assertTeach(ctx, csId);
  const logs = await db.select().from(lessonLogs).where(eq(lessonLogs.classSubjectId, csId)).orderBy(desc(lessonLogs.date)).limit(limit);
  if (!logs.length) return [];
  const items = await db
    .select({ logId: lessonLogTopics.lessonLogId, title: topics.title, status: lessonLogTopics.status })
    .from(lessonLogTopics)
    .innerJoin(topics, eq(topics.id, lessonLogTopics.topicId))
    .where(inArray(lessonLogTopics.lessonLogId, logs.map((l) => l.id)));
  return logs.map((l) => ({ id: l.id, date: l.date, noLessonReason: l.noLessonReason, note: l.note, topics: items.filter((i) => i.logId === l.id) }));
}

