import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { activityLog, assessments, classes, classSubjects, jobRuns, notifications, students, subjects } from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { addDays, monthStart, todayPkt, weekStart } from "@/lib/dates";
import { forbidden } from "@/server/http";
import { teacherClassSubjectIds } from "@/server/policy/scope";
import { listAnnouncements } from "./announcements";
import { feeOverview, financeSummary, parentFees } from "./fees";
import { myTeachingToday, parentProgress, progressDashboard } from "./progress";
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

/** Teachers needing attention: behind subjects, no plan this week, or no log in 3+ working days. */
async function teachersNeedingAttention(ctx: Ctx) {
  const rows = await progressDashboard(ctx);
  const today = todayPkt();
  const by = new Map<string, { teacherId: string; teacherName: string; reasons: Set<string> }>();
  for (const r of rows) {
    if (!r.teacherId) continue;
    const e = by.get(r.teacherId) ?? { teacherId: r.teacherId, teacherName: r.teacherName ?? "", reasons: new Set<string>() };
    if (r.progress.status === "behind") e.reasons.add(`${r.subjectName} ${r.className} behind`);
    if (r.planStatus !== "submitted") e.reasons.add("Plan not submitted");
    if (!r.lastLog || r.lastLog < addDays(today, -4)) e.reasons.add("No recent lesson log");
    by.set(r.teacherId, e);
  }
  const statusCounts = { on_track: 0, at_risk: 0, behind: 0 };
  for (const r of rows) if (r.progress.status in statusCounts) statusCounts[r.progress.status as keyof typeof statusCounts]++;
  return {
    statusCounts,
    teachers: [...by.values()].filter((t) => t.reasons.size).map((t) => ({ ...t, reasons: [...t.reasons] })).slice(0, 8),
    missingPlans: rows.filter((r) => r.planStatus !== "submitted").length,
    noLogToday: rows.filter((r) => r.lastLog !== today).length,
    total: rows.length,
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
    teachersNeedingAttention(ctx),
    pendingPublish(ctx.academyId),
    systemHealth(),
  ]);
  return { asOf: new Date(), month, students: stu, finance: fin, salaries: net, teaching: teach, tests: pend, health };
}

/** FR-DSH-02 — Admin dashboard (counts only, no money). */
export async function adminDashboard(ctx: Ctx) {
  if (ctx.role !== "admin") throw forbidden();
  const month = monthStart(todayPkt());
  const [stu, fees, teach, pend] = await Promise.all([studentCounts(ctx.academyId), feeOverview(ctx, month), teachersNeedingAttention(ctx), pendingPublish(ctx.academyId)]);
  return { asOf: new Date(), month, students: stu, fees: fees.totals, feesGenerated: fees.generated, teaching: teach, tests: pend };
}

/** FR-DSH-03 — Teacher "Today". */
export async function teacherDashboard(ctx: Ctx) {
  if (ctx.role !== "teacher") throw forbidden();
  const today = todayPkt();
  const csIds = await teacherClassSubjectIds(ctx.userId, ctx.academyId);
  const [subjectsToday, progress, drafts] = await Promise.all([
    myTeachingToday(ctx),
    progressDashboard(ctx),
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
  const ws = weekStart(today);
  const plansDue = subjectsToday.filter((s) => s.planStatus !== "submitted");
  return {
    today,
    weekStart: ws,
    subjects: subjectsToday.map((s) => ({ ...s, progress: progress.find((p) => p.id === s.id)?.progress ?? null })),
    pending: { plansDue, logsMissing: subjectsToday.filter((s) => !s.loggedToday), drafts },
  };
}

/** FR-DSH-04 — Parent home per child. */
export async function parentDashboard(ctx: Ctx, studentId?: string) {
  if (ctx.role !== "parent") throw forbidden();
  const kids = await myChildren(ctx);
  if (!kids.length) return { kids, child: null };
  const child = kids.find((k) => k.id === studentId) ?? kids[0]!;
  const month = monthStart(todayPkt());
  const [results, fees, progress, ann] = await Promise.all([studentResults(ctx, child.id), parentFees(ctx), parentProgress(ctx, child.id), listAnnouncements(ctx, 3)]);
  const feeThisMonth = fees.find((f) => f.studentId === child.id && f.month === month) ?? null;
  const unpaidMonths = fees.filter((f) => f.studentId === child.id && f.status === "unpaid").length;
  return {
    kids,
    child,
    latestResult: results.items[0] ?? null,
    overall: results.overall,
    feeThisMonth,
    unpaidMonths,
    thisWeek: progress.subjects.filter((s) => s.thisWeek.length || s.homework.length),
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

