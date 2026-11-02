import "server-only";
import { and, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  academy,
  assessments,
  classes,
  classSubjects,
  classSubjectTeachers,
  feeRows,
  jobRuns,
  lessonLogs,
  parentLinks,
  roleAssignments,
  sessions,
  setupTokens,
  students,
  subjects,
  users,
  weeklyPlans,
} from "@/server/db/schema";
import { addDays, isWorkingDay, isoWeekday, monthStart, todayPkt, weekStart } from "@/lib/dates";
import { formatMonth, TZ } from "@/lib/format";
import { getAcademy, getCurrentYear } from "./academy";
import { generateMonthRows } from "./fees";
import { purgeOldNotifications } from "./notifications";
import { queueNotifications, type NewNotification } from "./notify";
import { sendDailySummaries, sendPendingPushes } from "./push";
import { generateSalaryRows } from "./salaries";

/** Current time in Pakistan as HH:MM. */
function pktTime(d = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** Claim a run key; returns false if this job already ran for the key (SRS §9 single-instance). */
async function claim(job: string, runKey: string): Promise<string | null> {
  const r = await db.insert(jobRuns).values({ job, runKey }).onConflictDoNothing().returning({ id: jobRuns.id });
  return r[0]?.id ?? null;
}
async function finish(id: string, ok: boolean, result: unknown) {
  await db.update(jobRuns).set({ finishedAt: new Date(), ok, result: result as object }).where(eq(jobRuns.id, id));
}

async function runOnce(job: string, runKey: string, fn: () => Promise<unknown>) {
  const id = await claim(job, runKey);
  if (!id) return { job, skipped: true };
  try {
    const result = await fn();
    await finish(id, true, result);
    return { job, ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finish(id, false, { error: message });
    await alertOwners(`Scheduled job failed: ${job}`, message);
    return { job, ok: false, error: message };
  }
}

/** NFR-REL-05: final failures alert the Super Admin's system notifications. */
async function alertOwners(title: string, body: string) {
  const owners = await db
    .select({ userId: roleAssignments.userId })
    .from(roleAssignments)
    .where(and(eq(roleAssignments.role, "super_admin"), eq(roleAssignments.active, true)));
  await queueNotifications(db, owners.map((o) => ({ userId: o.userId, role: "super_admin" as const, type: "system.job_failed", title, body: body.slice(0, 300), link: "/settings" })));
}

async function academies() {
  return db.select({ id: academy.id }).from(academy);
}

// ─── Jobs ───────────────────────────────────────────────────────────────────
/** monthly-rows (1st, 00:05): fee + salary rows for the month (BR-FEE-02, BR-SAL-02). */
export async function jobMonthlyRows(month = monthStart(todayPkt())) {
  const out = [];
  for (const a of await academies()) {
    const fees = await generateMonthRows(a.id, month, null);
    const salaries = await generateSalaryRows(a.id, month, null);
    const owners = await db
      .select({ userId: roleAssignments.userId })
      .from(roleAssignments)
      .innerJoin(users, eq(users.id, roleAssignments.userId))
      .where(and(eq(users.academyId, a.id), eq(roleAssignments.role, "super_admin"), eq(roleAssignments.active, true)));
    await queueNotifications(
      db,
      owners.map((o) => ({
        userId: o.userId,
        role: "super_admin" as const,
        type: "system.monthly_rows",
        title: `${formatMonth(month)} lists created`,
        body: `${fees.created} fee rows (${fees.skipped} already existed) and ${salaries.created} salary rows.`,
        link: "/finance",
      })),
    );
    out.push({ academyId: a.id, fees, salaries });
  }
  return out;
}

/** lesson-log-reminder (working days, setting time): class-subjects with no log today (FR-TPR-13). */
export async function jobLessonLogReminder() {
  const today = todayPkt();
  const notes: NewNotification[] = [];
  for (const a of await academies()) {
    const year = await getCurrentYear(a.id);
    if (!year || !isWorkingDay(year.calendar, today)) continue;
    const missing = await db
      .select({ teacherId: classSubjectTeachers.teacherId, subjectName: subjects.name, className: classes.name, csId: classSubjects.id })
      .from(classSubjectTeachers)
      .innerJoin(classSubjects, eq(classSubjects.id, classSubjectTeachers.classSubjectId))
      .innerJoin(classes, eq(classes.id, classSubjects.classId))
      .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
      .where(
        and(
          isNull(classSubjectTeachers.toDate),
          eq(classes.academicYearId, year.id),
          isNull(classes.archivedAt),
          sql`not exists (select 1 from ${lessonLogs} l where l.class_subject_id = ${classSubjects.id} and l.date = ${today}::date)`,
        ),
      );
    const byTeacher = new Map<string, typeof missing>();
    for (const m of missing) byTeacher.set(m.teacherId, [...(byTeacher.get(m.teacherId) ?? []), m]);
    for (const [teacherId, list] of byTeacher) {
      notes.push({
        userId: teacherId,
        role: "teacher",
        type: "reminder.lesson_log",
        title: "Log today's lessons",
        body: list.map((l) => `${l.subjectName} · ${l.className}`).join(", "),
        link: list.length === 1 ? `/lesson/${list[0]!.csId}` : "/progress",
      });
    }
  }
  await queueNotifications(db, notes);
  return { reminded: notes.length };
}

/** weekly-plan-reminder (Monday at deadline): teachers with missing plans (FR-TPR-13). */
export async function jobWeeklyPlanReminder() {
  const ws = weekStart(todayPkt());
  const rows = await db
    .select({ teacherId: classSubjectTeachers.teacherId, subjectName: subjects.name, className: classes.name })
    .from(classSubjectTeachers)
    .innerJoin(classSubjects, eq(classSubjects.id, classSubjectTeachers.classSubjectId))
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .where(
      and(
        isNull(classSubjectTeachers.toDate),
        isNull(classes.archivedAt),
        sql`not exists (select 1 from ${weeklyPlans} p where p.class_subject_id = ${classSubjects.id} and p.week_start = ${ws}::date and p.status = 'submitted')`,
      ),
    );
  const by = new Map<string, string[]>();
  for (const r of rows) by.set(r.teacherId, [...(by.get(r.teacherId) ?? []), `${r.subjectName} · ${r.className}`]);
  await queueNotifications(
    db,
    [...by].map(([userId, list]) => ({ userId, role: "teacher" as const, type: "reminder.weekly_plan", title: "Weekly plan not submitted", body: list.join(", "), link: "/plans" })),
  );
  return { reminded: by.size };
}

/** results-reminder (daily 10:00): drafts dated ≥ 3 days ago (FR-RES-11). */
export async function jobResultsReminder() {
  const cutoff = addDays(todayPkt(), -3);
  const rows = await db
    .select({ teacherId: classSubjectTeachers.teacherId, title: assessments.title, id: assessments.id })
    .from(assessments)
    .innerJoin(classSubjectTeachers, and(eq(classSubjectTeachers.classSubjectId, assessments.classSubjectId), isNull(classSubjectTeachers.toDate)))
    .where(and(inArray(assessments.status, ["draft", "unlocked"]), lte(assessments.date, cutoff)));
  const by = new Map<string, { title: string; id: string }[]>();
  for (const r of rows) by.set(r.teacherId, [...(by.get(r.teacherId) ?? []), r]);
  await queueNotifications(
    db,
    [...by].map(([userId, list]) => ({
      userId,
      role: "teacher" as const,
      type: "reminder.results",
      title: `${list.length} test${list.length === 1 ? "" : "s"} waiting to be published`,
      body: list.map((l) => l.title).join(", "),
      link: list.length === 1 ? `/results/${list[0]!.id}` : "/results",
    })),
  );
  return { reminded: by.size };
}

/** fee-reminder (configured day, 10:00): one notification per parent with unpaid months (BR-FEE-10). */
export async function jobFeeReminder(academyId: string) {
  const rows = await db
    .select({ parentId: parentLinks.parentUserId, studentName: students.name, month: feeRows.month })
    .from(feeRows)
    .innerJoin(students, eq(students.id, feeRows.studentId))
    .innerJoin(parentLinks, eq(parentLinks.studentId, students.id))
    .where(and(eq(feeRows.academyId, academyId), eq(feeRows.status, "unpaid"), eq(students.status, "active")));
  const by = new Map<string, string[]>();
  for (const r of rows) by.set(r.parentId, [...(by.get(r.parentId) ?? []), `${r.studentName.split(" ")[0]} — ${formatMonth(r.month, true)}`]);
  await queueNotifications(
    db,
    [...by].map(([userId, list]) => ({ userId, role: "parent" as const, type: "fee.reminder", title: "Fee reminder", body: `Unpaid: ${list.join(", ")}`, pushText: "Fee reminder — tap to view", link: "/fees" })),
  );
  return { reminded: by.size };
}

/** attendance-reminder is intentionally absent: Attendance is deferred by the owner. */

/** cleanup (daily 03:00): expired sessions & used tokens > 30 days, notifications > 12 months. */
export async function jobCleanup() {
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  const s = await db.delete(sessions).where(or(lt(sessions.expiresAt, cutoff), lt(sessions.revokedAt, cutoff))).returning({ id: sessions.id });
  const t = await db.delete(setupTokens).where(or(lt(setupTokens.expiresAt, cutoff), lt(setupTokens.usedAt, cutoff))).returning({ id: setupTokens.id });
  const n = await purgeOldNotifications();
  const j = await db.delete(jobRuns).where(lt(jobRuns.startedAt, new Date(Date.now() - 90 * 86_400_000))).returning({ id: jobRuns.id });
  return { sessions: s.length, tokens: t.length, notifications: n, jobRuns: j.length };
}

// ─── Scheduler tick (call every 5–15 minutes) ──────────────────────────────
const at = (now: string, hhmm: string) => now >= hhmm;

/**
 * Runs whatever is due in Pakistan time. Each job is claimed per period in
 * job_runs, so overlapping or repeated ticks never double-run anything.
 */
export async function tick() {
  const today = todayPkt();
  const now = pktTime();
  const results: unknown[] = [];

  results.push({ job: "push-sender", ...(await sendPendingPushes()) });

  // Monthly rows: first tick on/after the 1st at 00:05 creates the month (catch-up safe, idempotent).
  if (!today.endsWith("-01") || at(now, "00:05")) {
    results.push(await runOnce("monthly-rows", monthStart(today), () => jobMonthlyRows(monthStart(today))));
  }
  for (const a of await academies()) {
    const { settings } = await getAcademy(a.id);
    const year = await getCurrentYear(a.id);
    const working = year ? isWorkingDay(year.calendar, today) : false;
    if (working && at(now, settings.lessonLogReminderTime)) results.push(await runOnce("lesson-log-reminder", today, jobLessonLogReminder));
    if (isoWeekday(today) === settings.weeklyPlanDeadline.weekday && at(now, settings.weeklyPlanDeadline.time)) {
      results.push(await runOnce("weekly-plan-reminder", today, jobWeeklyPlanReminder));
    }
    if (settings.feeReminderEnabled && Number(today.slice(8)) === settings.feeReminderDay && at(now, "10:00")) {
      results.push(await runOnce(`fee-reminder:${a.id}`, today, () => jobFeeReminder(a.id)));
    }
  }
  if (at(now, "10:00")) results.push(await runOnce("results-reminder", today, jobResultsReminder));
  if (at(now, "19:00")) results.push(await runOnce("parent-daily-summary", today, sendDailySummaries));
  if (at(now, "03:00")) results.push(await runOnce("cleanup", today, jobCleanup));
  return { at: `${today} ${now} PKT`, results };
}

/** For the System health card. */
export async function lastJobRuns() {
  return db
    .select({ job: jobRuns.job, runKey: jobRuns.runKey, ok: jobRuns.ok, finishedAt: jobRuns.finishedAt, result: jobRuns.result })
    .from(jobRuns)
    .where(gte(jobRuns.startedAt, new Date(Date.now() - 35 * 86_400_000)))
    .orderBy(sql`${jobRuns.startedAt} desc`)
    .limit(30);
}
