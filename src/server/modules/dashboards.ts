import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { activityLog, assessments, classes, classSubjects, jobRuns, notifications, students, subjects } from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { addDays, monthStart, todayPkt } from "@/lib/dates";
import { forbidden } from "@/server/http";
import { teacherClassSubjectIds } from "@/server/policy/scope";
import { listAnnouncements } from "./announcements";
import { feeOverview, financeSummary, parentFees } from "./fees";
import { parentClassLog, teacherConsistency, teacherToday, teachingDay } from "./teaching";
import { studentResults } from "./results";
import { netForMonth } from "./salaries";
import { myChildren } from "./students";

async function studentCounts(academyId: string) {
  const month = monthStart(todayPkt());
  const [[active], [added], [removed]] = await Promise.all([
    db.select({ n: count() }).from(students).where(and(eq(students.academyId, academyId), eq(students.status, "active"))),
    db.select({ n: count() }).from(students).where(and(eq(students.academyId, academyId), gte(students.admissionDate, month))),
    db.select({ n: count() }).from(students).where(and(eq(students.academyId, academyId), eq(students.status, "removed"), gte(students.removedOn, month))),
  ]);
  return { active: active?.n ?? 0, addedThisMonth: added?.n ?? 0, removedThisMonth: removed?.n ?? 0 };
}

async function pendingPublish(academyId: string) {
  const cutoff = addDays(todayPkt(), -3);
  const [r] = await db
    .select({ total: count(), overdue: sql<number>`count(*) filter (where ${assessments.date} <= ${cutoff}::date)::int` })
    .from(assessments)
    .where(and(eq(assessments.academyId, academyId), inArray(assessments.status, ["draft", "unlocked"])));
  return { total: r?.total ?? 0, overdue: r?.overdue ?? 0 };
}

/** Daily-log picture for the office: today's count + teachers who missed days recently. */
async function teachingSnapshot(ctx: Ctx) {
  const [day, consistency] = await Promise.all([teachingDay(ctx, todayPkt()), teacherConsistency(ctx, { count: 5 })]);
  return {
    isWorkingDay: day.isWorkingDay,
    logged: day.logged,
    total: day.total,
    // Anyone who missed at least one of the last 5 working days, worst first.
    teachers: consistency
      .filter((t) => t.missedDays > 0 || (t.pct ?? 100) < 100)
      .slice(0, 6)
      .map((t) => ({ teacherId: t.teacherId, teacherName: t.teacherName, pct: t.pct, missedDays: t.missedDays, lastLog: t.lastLog, days: t.days })),
  };
}

/** FR-DSH-01 — Super Admin overview (with money). */
export async function ownerDashboard(ctx: Ctx) {
  if (ctx.role !== "super_admin") throw forbidden();
  const month = monthStart(todayPkt());
  const [stu, fin, net, teach, pend, health] = await Promise.all([
    studentCounts(ctx.academyId),
    financeSummary(ctx, month),
    netForMonth(ctx, month),
    teachingSnapshot(ctx),
    pendingPublish(ctx.academyId),
    systemHealth(),
  ]);
  return { asOf: new Date(), month, students: stu, finance: fin, salaries: net, teaching: teach, tests: pend, health };
}

/** FR-DSH-02 — Admin dashboard (counts only, no money). */
export async function adminDashboard(ctx: Ctx) {
  if (ctx.role !== "admin") throw forbidden();
  const month = monthStart(todayPkt());
  const [stu, fees, teach, pend] = await Promise.all([studentCounts(ctx.academyId), feeOverview(ctx, month), teachingSnapshot(ctx), pendingPublish(ctx.academyId)]);
  return { asOf: new Date(), month, students: stu, fees: fees.totals, feesGenerated: fees.generated, teaching: teach, tests: pend };
}

/** FR-DSH-03 — Teacher "Today". */
export async function teacherDashboard(ctx: Ctx) {
  if (ctx.role !== "teacher") throw forbidden();
  const csIds = await teacherClassSubjectIds(ctx.userId, ctx.academyId);
  const [log, drafts] = await Promise.all([
    teacherToday(ctx),
    csIds.length
      ? db
          .select({ id: assessments.id, title: assessments.title, date: assessments.date, subjectName: subjects.name, className: classes.name })
          .from(assessments)
          .innerJoin(classSubjects, eq(classSubjects.id, assessments.classSubjectId))
          .innerJoin(classes, eq(classes.id, classSubjects.classId))
          .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
          .where(and(inArray(assessments.classSubjectId, csIds), inArray(assessments.status, ["draft", "unlocked"])))
          .orderBy(assessments.date)
      : Promise.resolve([]),
  ]);
  return { log, drafts };
}

/** FR-DSH-04 — Parent home per child. */
export async function parentDashboard(ctx: Ctx, studentId?: string) {
  if (ctx.role !== "parent") throw forbidden();
  const kids = await myChildren(ctx);
  if (!kids.length) return { kids, child: null };
  const child = kids.find((k) => k.id === studentId) ?? kids[0]!;
  const month = monthStart(todayPkt());
  const [results, fees, classLog, ann] = await Promise.all([studentResults(ctx, child.id), parentFees(ctx), parentClassLog(ctx, child.id, 3), listAnnouncements(ctx, 3)]);
  const feeThisMonth = fees.find((f) => f.studentId === child.id && f.month === month) ?? null;
  const unpaidMonths = fees.filter((f) => f.studentId === child.id && f.status === "unpaid").length;
  return {
    kids,
    child,
    latestResult: results.items[0] ?? null,
    overall: results.overall,
    feeThisMonth,
    unpaidMonths,
    // Most recent entry per subject from the last few days.
    recentClass: classLog.subjects.filter((s) => s.entries.length).map((s) => ({ subjectName: s.subjectName, entry: s.entries[0]! })),
    announcement: ann[0] ?? null,
  };
}

/** SRS §12.4 "System health" card. */
export async function systemHealth() {
  const [lastMonthly] = await db.select().from(jobRuns).where(eq(jobRuns.job, "monthly-rows")).orderBy(desc(jobRuns.startedAt)).limit(1);
  const [lastTick] = await db.select({ at: jobRuns.startedAt }).from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(1);
  const [failedJobs] = await db.select({ n: count() }).from(jobRuns).where(and(eq(jobRuns.ok, false), gte(jobRuns.startedAt, new Date(Date.now() - 7 * 86_400_000))));
  const [pushFailed] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(isNull(notifications.pushSentAt), isNull(notifications.pushCancelledAt), gte(notifications.pushAttempts, 3), gte(notifications.createdAt, new Date(Date.now() - 86_400_000))));
  return {
    lastMonthlyRun: lastMonthly ? { month: lastMonthly.runKey, ok: lastMonthly.ok, at: lastMonthly.finishedAt } : null,
    lastJobAt: lastTick?.at ?? null,
    failedJobs7d: failedJobs?.n ?? 0,
    pushFailures24h: pushFailed?.n ?? 0,
    pushConfigured: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    cronConfigured: !!process.env.CRON_SECRET,
  };
}

/** Admin activity this week (FR-DSH-05). */
export async function actionsThisWeek(academyId: string) {
  const since = new Date(Date.now() - 7 * 86_400_000);
  return db
    .select({ actorId: activityLog.actorId, n: count() })
    .from(activityLog)
    .where(and(eq(activityLog.academyId, academyId), gte(activityLog.at, since)))
    .groupBy(activityLog.actorId);
}

