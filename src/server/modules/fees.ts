import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { classes, classFees, enrollments, feeRows, studentFees, students, users } from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { rows as execRows } from "@/server/db/connect";
import { addMonths, monthEnd, monthStart, todayPkt } from "@/lib/dates";
import { formatMonth } from "@/lib/format";
import { isStaffAdmin } from "@/lib/roles";
import { badRequest, conflict, forbidden, notFound } from "@/server/http";
import { assertClassVisible, assertStudentVisible, parentStudentIds, teacherClassIds } from "@/server/policy/scope";
import { getSettings, requireCurrentYear } from "./academy";
import { logActivity } from "./audit";
import { effectiveFee } from "./fee-rows";
import { parentsOf, queueNotifications, withdrawRecent } from "./notify";

/** Amounts are visible to Super Admin, Admin and the student's parents — never teachers (SRS §5.4). */
export const seesFeeAmounts = (ctx: Ctx) => ctx.role !== "teacher";
const assertOwner = (ctx: Ctx) => {
  if (ctx.role !== "super_admin") throw forbidden("Only the owner can do this");
};
const currentMonth = () => monthStart(todayPkt());

// ─── Fee amounts (Super Admin) ──────────────────────────────────────────────
/** FR-FEE-01 / BR-FEE-04 */
export async function setClassFee(ctx: Ctx, classId: string, amount: number, alsoThisMonth: boolean) {
  assertOwner(ctx);
  const month = currentMonth();
  return db.transaction(async (tx) => {
    const [cls] = await tx.select({ name: classes.name }).from(classes).where(and(eq(classes.id, classId), eq(classes.academyId, ctx.academyId)));
    if (!cls) throw notFound("Class");
    const [before] = await tx.select({ fee: classFees.monthlyFee }).from(classFees).where(eq(classFees.classId, classId));
    await tx
      .insert(classFees)
      .values({ classId, monthlyFee: amount, setBy: ctx.userId })
      .onConflictDoUpdate({ target: classFees.classId, set: { monthlyFee: amount, setBy: ctx.userId, setAt: new Date() } });
    let updated = 0;
    if (alsoThisMonth) {
      // Only unpaid rows of students without a personal fee follow the class default.
      const res = await tx
        .update(feeRows)
        .set({ amount, version: sql`${feeRows.version} + 1` })
        .where(
          and(
            eq(feeRows.classId, classId),
            eq(feeRows.month, month),
            eq(feeRows.status, "unpaid"),
            sql`not exists (select 1 from ${studentFees} sf where sf.student_id = ${feeRows.studentId})`,
          ),
        )
        .returning({ id: feeRows.id });
      updated = res.length;
    }
    await logActivity(tx, ctx, {
      action: "fee.class_set",
      entityType: "class",
      entityId: classId,
      summary: `Set ${cls.name} monthly fee to Rs ${amount.toLocaleString("en-PK")}${alsoThisMonth ? ` (also ${updated} unpaid rows this month)` : ""}`,
      before: { monthlyFee: before?.fee ?? null },
      after: { monthlyFee: amount, alsoThisMonth, updated },
      sensitivity: "finance_amount",
    });
    return { updated };
  });
}

/** FR-FEE-02 / BR-FEE-04: personal fee (null clears it → class default applies). */
export async function setStudentFee(ctx: Ctx, studentId: string, amount: number | null, note: string | null, alsoThisMonth: boolean) {
  assertOwner(ctx);
  const month = currentMonth();
  return db.transaction(async (tx) => {
    const [s] = await tx.select({ name: students.name }).from(students).where(and(eq(students.id, studentId), eq(students.academyId, ctx.academyId)));
    if (!s) throw notFound("Student");
    const [before] = await tx.select().from(studentFees).where(eq(studentFees.studentId, studentId));
    if (amount === null) await tx.delete(studentFees).where(eq(studentFees.studentId, studentId));
    else
      await tx
        .insert(studentFees)
        .values({ studentId, monthlyFee: amount, note, setBy: ctx.userId })
        .onConflictDoUpdate({ target: studentFees.studentId, set: { monthlyFee: amount, note, setBy: ctx.userId, setAt: new Date() } });

    let updated = false;
    if (alsoThisMonth) {
      const [row] = await tx.select().from(feeRows).where(and(eq(feeRows.studentId, studentId), eq(feeRows.month, month)));
      if (row && row.status === "unpaid") {
        const eff = await effectiveFee(tx, studentId, row.classId);
        await tx.update(feeRows).set({ amount: eff.amount, version: sql`${feeRows.version} + 1` }).where(eq(feeRows.id, row.id));
        updated = true;
      }
    }
    await logActivity(tx, ctx, {
      action: amount === null ? "fee.student_clear" : "fee.student_set",
      entityType: "student",
      entityId: studentId,
      summary: amount === null ? `Cleared personal fee of ${s.name}` : `Set personal fee of ${s.name} to Rs ${amount.toLocaleString("en-PK")}`,
      before: before ? { monthlyFee: before.monthlyFee, note: before.note } : null,
      after: { monthlyFee: amount, note, alsoThisMonth, updated },
      sensitivity: "finance_amount",
    });
    return { updated };
  });
}

// ─── Monthly rows ───────────────────────────────────────────────────────────
/**
 * BR-FEE-02: one row per student whose enrollment covers the month (or starts
 * in it, per setting). INSERT … ON CONFLICT DO NOTHING — safe to run twice.
 */
export async function generateMonthRows(academyId: string, month: string, actor: Ctx | null) {
  if (monthStart(month) !== month) throw badRequest("BAD_MONTH", "Pick a month");
  if (month > addMonths(currentMonth(), 1)) throw badRequest("FUTURE_MONTH", "You can only create the current or next month");
  const settings = await getSettings(academyId);
  const end = monthEnd(month);
  return db.transaction(async (tx) => {
    const created = await execRows<{ id: string }>(
      tx as never,
      sql`
        insert into fee_rows (academy_id, student_id, class_id, month, amount)
        select distinct on (s.id) s.academy_id, s.id, e.class_id, ${month}::date,
               coalesce(sf.monthly_fee, cf.monthly_fee, 0)
        from students s
        join enrollments e on e.student_id = s.id
        join classes c on c.id = e.class_id
        left join student_fees sf on sf.student_id = s.id
        left join class_fees cf on cf.class_id = e.class_id
        where s.academy_id = ${academyId}
          and e.from_date <= ${settings.feeRowOnJoin ? end : month}::date
          and (e.to_date is null or e.to_date >= ${month}::date)
        order by s.id, (e.from_date <= ${month}::date) desc, e.from_date desc
        on conflict (student_id, month) do nothing
        returning id`,
    );
    const [{ n: total } = { n: 0 }] = await tx.select({ n: count() }).from(feeRows).where(and(eq(feeRows.academyId, academyId), eq(feeRows.month, month)));
    if (actor) {
      await logActivity(tx, actor, {
        action: "fee.generate",
        entityType: "fee_month",
        summary: `Created ${formatMonth(month)} fee list (${created.length} new rows)`,
        after: { month, created: created.length, total },
      });
    }
    return { created: created.length, skipped: total - created.length, total };
  });
}

// ─── Marking ────────────────────────────────────────────────────────────────
async function loadRowForMarking(tx: Tx, ctx: Ctx, rowId: string) {
  const [row] = await tx
    .select({ row: feeRows, studentName: students.name })
    .from(feeRows)
    .innerJoin(students, eq(students.id, feeRows.studentId))
    .where(and(eq(feeRows.id, rowId), eq(feeRows.academyId, ctx.academyId)));
  if (!row) throw notFound("Fee row");
  return row;
}

export type MarkResult = { id: string; status: "paid" | "unpaid" | "waived"; markedAt: Date | null; markedByName: string | null; version: number };

/** FR-FEE-06 / BR-FEE-05 / BR-FEE-06 */
export async function markFee(ctx: Ctx, rowId: string, to: "paid" | "unpaid", note?: string | null): Promise<MarkResult> {
  if (!isStaffAdmin(ctx.role) && ctx.role !== "teacher") throw forbidden();
  const settings = await getSettings(ctx.academyId);
  // Teacher scope is resolved before the transaction (single-connection safe).
  const [peek] = await db.select({ studentId: feeRows.studentId, month: feeRows.month }).from(feeRows).where(and(eq(feeRows.id, rowId), eq(feeRows.academyId, ctx.academyId)));
  if (!peek) throw notFound("Fee row");
  if (ctx.role === "teacher") {
    await assertStudentVisible(ctx, peek.studentId);
    if (peek.month > currentMonth()) throw forbidden("You can't mark future months");
  }

  return db.transaction(async (tx) => {
    const { row, studentName } = await loadRowForMarking(tx, ctx, rowId);
    if (row.status === "waived" && ctx.role !== "super_admin") throw forbidden("Only the owner can change a waived month");
    if (row.status === to) return { id: row.id, status: row.status, markedAt: row.markedAt, markedByName: null, version: row.version };

    const now = new Date();
    const [after] = await tx
      .update(feeRows)
      .set({
        status: to,
        markedBy: to === "paid" ? ctx.userId : null,
        markedAt: to === "paid" ? now : null,
        note: note === undefined ? row.note : note,
        waiveReason: null,
        version: sql`${feeRows.version} + 1`,
      })
      .where(eq(feeRows.id, rowId))
      .returning();

    await logActivity(tx, ctx, {
      action: to === "paid" ? "fee_row.mark_paid" : row.status === "waived" ? "fee_row.unwaive" : "fee_row.mark_unpaid",
      entityType: "fee_row",
      entityId: rowId,
      summary: `${to === "paid" ? "Marked paid" : row.status === "waived" ? "Un-waived" : "Marked unpaid"}: ${studentName}, ${formatMonth(row.month)}`,
      before: { status: row.status },
      after: { status: to, note: after!.note },
      sensitivity: row.status === "waived" ? "finance_amount" : "normal",
    });

    const link = `/fees?row=${rowId}`;
    if (to === "paid" && settings.notifyParentOnPaid) {
      const parents = (await parentsOf(tx, [row.studentId])).get(row.studentId) ?? [];
      await queueNotifications(
        tx,
        parents.map((userId) => ({
          userId,
          role: "parent" as const,
          type: "fee.paid",
          title: `${formatMonth(row.month)} fee received`,
          body: `${studentName}'s fee for ${formatMonth(row.month)} is marked Paid.`,
          pushText: `Fee update for ${studentName.split(" ")[0]} — tap to view`,
          link,
        })),
      );
    } else if (to === "unpaid") {
      await withdrawRecent(tx, "fee.paid", link); // quick undo → no confusing push
    }
    return { id: after!.id, status: after!.status, markedAt: after!.markedAt, markedByName: to === "paid" ? ctx.name : null, version: after!.version };
  });
}

/** FR-FEE-07: Super Admin only, reason required; excluded from expected revenue. */
export async function waiveFee(ctx: Ctx, rowId: string, reason: string) {
  assertOwner(ctx);
  if (!reason.trim()) throw badRequest("REASON_REQUIRED", "Give a reason", { fields: { reason: "Give a reason" } });
  return db.transaction(async (tx) => {
    const { row, studentName } = await loadRowForMarking(tx, ctx, rowId);
    if (row.status === "paid") throw conflict("ALREADY_PAID", "This month is already paid");
    await tx
      .update(feeRows)
      .set({ status: "waived", waiveReason: reason.trim(), markedBy: ctx.userId, markedAt: new Date(), version: sql`${feeRows.version} + 1` })
      .where(eq(feeRows.id, rowId));
    await logActivity(tx, ctx, {
      action: "fee_row.waive",
      entityType: "fee_row",
      entityId: rowId,
      summary: `Waived ${studentName}, ${formatMonth(row.month)}`,
      before: { status: row.status, amount: row.amount },
      after: { status: "waived" },
      reason,
      sensitivity: "finance_amount",
    });
  });
}

// ─── Lists ──────────────────────────────────────────────────────────────────
export type FeeListRow = {
  id: string;
  studentId: string;
  name: string;
  rollNo: string | null;
  status: "paid" | "unpaid" | "waived";
  amount?: number;
  markedAt: Date | null;
  markedByName: string | null;
  note: string | null;
  version: number;
};
export type FeeCounts = { paid: number; unpaid: number; waived: number; total: number };

const countRows = (rows: { status: string }[]): FeeCounts => ({
  paid: rows.filter((r) => r.status === "paid").length,
  unpaid: rows.filter((r) => r.status === "unpaid").length,
  waived: rows.filter((r) => r.status === "waived").length,
  total: rows.length,
});

/** FR-FEE-08: one class, one month. Teachers get no amounts. */
export async function classFeeList(ctx: Ctx, classId: string, month: string) {
  if (ctx.role === "parent") throw forbidden();
  await assertClassVisible(ctx, classId);
  const [cls] = await db.select({ id: classes.id, name: classes.name }).from(classes).where(and(eq(classes.id, classId), eq(classes.academyId, ctx.academyId)));
  if (!cls) throw notFound("Class");
  const rows = await db
    .select({
      id: feeRows.id,
      studentId: students.id,
      name: students.name,
      rollNo: sql<string | null>`(select e.roll_no from ${enrollments} e where e.student_id = ${students.id} and e.class_id = ${classId} order by e.to_date is null desc, e.from_date desc limit 1)`,
      status: feeRows.status,
      amount: feeRows.amount,
      markedAt: feeRows.markedAt,
      markedByName: users.name,
      note: feeRows.note,
      version: feeRows.version,
    })
    .from(feeRows)
    .innerJoin(students, eq(students.id, feeRows.studentId))
    .leftJoin(users, eq(users.id, feeRows.markedBy))
    .where(and(eq(feeRows.classId, classId), eq(feeRows.month, month)));
  rows.sort((a, b) => (Number(a.rollNo) || 9999) - (Number(b.rollNo) || 9999) || a.name.localeCompare(b.name));
  const amounts = seesFeeAmounts(ctx);
  const items: FeeListRow[] = rows.map(({ amount, ...r }) => (amounts ? { ...r, amount } : r));
  const counts = countRows(rows);
  return {
    class: cls,
    month,
    rows: items,
    counts,
    ...(amounts ? { totals: { expected: rows.filter((r) => r.status !== "waived").reduce((n, r) => n + r.amount, 0), recovered: rows.filter((r) => r.status === "paid").reduce((n, r) => n + r.amount, 0) } } : {}),
  };
}

/** FR-FEE-09: per-class counts for a month (teachers: their classes). No money. */
export async function feeOverview(ctx: Ctx, month: string) {
  if (ctx.role === "parent") throw forbidden();
  const year = await requireCurrentYear(ctx.academyId);
  const scope = ctx.role === "teacher" ? await teacherClassIds(ctx.userId, ctx.academyId) : null;
  if (scope && !scope.length) return { month, classes: [], totals: { paid: 0, unpaid: 0, waived: 0, total: 0 }, generated: false };
  const cls = await db
    .select({ id: classes.id, name: classes.name, shift: classes.shift })
    .from(classes)
    .where(and(eq(classes.academicYearId, year.id), isNull(classes.archivedAt), scope ? inArray(classes.id, scope) : undefined))
    .orderBy(asc(classes.level), asc(classes.name));
  const grouped = await db
    .select({ classId: feeRows.classId, status: feeRows.status, n: count() })
    .from(feeRows)
    .where(and(eq(feeRows.academyId, ctx.academyId), eq(feeRows.month, month), scope ? inArray(feeRows.classId, scope) : undefined))
    .groupBy(feeRows.classId, feeRows.status);
  const per = cls.map((c) => {
    const g = grouped.filter((x) => x.classId === c.id);
    const get = (s: string) => g.find((x) => x.status === s)?.n ?? 0;
    const paid = get("paid"), unpaid = get("unpaid"), waived = get("waived");
    return { ...c, paid, unpaid, waived, total: paid + unpaid + waived };
  });
  const totals = per.reduce((t, c) => ({ paid: t.paid + c.paid, unpaid: t.unpaid + c.unpaid, waived: t.waived + c.waived, total: t.total + c.total }), { paid: 0, unpaid: 0, waived: 0, total: 0 });
  const [{ n: rowsExist } = { n: 0 }] = await db.select({ n: count() }).from(feeRows).where(and(eq(feeRows.academyId, ctx.academyId), eq(feeRows.month, month)));
  return { month, classes: per, totals, generated: rowsExist > 0 };
}

/** FR-FEE-09 / BR-FEE-09: students with 2+ unpaid months. Amounts for Super Admin only. */
export async function unpaidMultiple(ctx: Ctx) {
  if (!isStaffAdmin(ctx.role)) throw forbidden();
  const rows = await db
    .select({
      studentId: students.id,
      name: students.name,
      status: students.status,
      registrationNo: students.registrationNo,
      months: sql<string[]>`array_agg(${feeRows.month}::text order by ${feeRows.month})`,
      amount: sql<number>`sum(${feeRows.amount})::int`,
      className: sql<string | null>`(select c.name from ${enrollments} e join ${classes} c on c.id = e.class_id where e.student_id = ${students.id} order by e.to_date is null desc, e.from_date desc limit 1)`,
    })
    .from(feeRows)
    .innerJoin(students, eq(students.id, feeRows.studentId))
    .where(and(eq(feeRows.academyId, ctx.academyId), eq(feeRows.status, "unpaid")))
    .groupBy(students.id)
    .having(sql`count(*) >= 2`)
    .orderBy(desc(sql`count(*)`), asc(students.name));
  return rows.map(({ amount, ...r }) => (ctx.role === "super_admin" ? { ...r, amount } : r));
}

/** FR-FEE-12: a parent's children, month by month, with amounts. */
export async function parentFees(ctx: Ctx) {
  if (ctx.role !== "parent") throw forbidden();
  const kids = await parentStudentIds(ctx.userId);
  if (!kids.length) return [];
  const rows = await db
    .select({ id: feeRows.id, studentId: feeRows.studentId, month: feeRows.month, amount: feeRows.amount, status: feeRows.status, markedAt: feeRows.markedAt })
    .from(feeRows)
    .where(inArray(feeRows.studentId, kids.map((k) => k.id)))
    .orderBy(desc(feeRows.month));
  return rows;
}

// ─── Finance (Super Admin only) ─────────────────────────────────────────────
/** BR-FEE-08 — always computed live with SQL aggregates. */
export async function financeSummary(ctx: Ctx, month: string) {
  assertOwner(ctx);
  const a = ctx.academyId;
  const [[active], [agg], byClass, [atCurrent], unpaidList] = await Promise.all([
    db.select({ n: count() }).from(students).where(and(eq(students.academyId, a), eq(students.status, "active"))),
    db
      .select({
        rows: count(),
        expected: sql<number>`coalesce(sum(${feeRows.amount}) filter (where ${feeRows.status} <> 'waived'), 0)::int`,
        recovered: sql<number>`coalesce(sum(${feeRows.amount}) filter (where ${feeRows.status} = 'paid'), 0)::int`,
        waived: sql<number>`coalesce(sum(${feeRows.amount}) filter (where ${feeRows.status} = 'waived'), 0)::int`,
        paidCount: sql<number>`count(*) filter (where ${feeRows.status} = 'paid')::int`,
        unpaidCount: sql<number>`count(*) filter (where ${feeRows.status} = 'unpaid')::int`,
        waivedCount: sql<number>`count(*) filter (where ${feeRows.status} = 'waived')::int`,
      })
      .from(feeRows)
      .where(and(eq(feeRows.academyId, a), eq(feeRows.month, month))),
    db
      .select({
        classId: classes.id,
        name: classes.name,
        students: count(),
        expected: sql<number>`coalesce(sum(${feeRows.amount}) filter (where ${feeRows.status} <> 'waived'), 0)::int`,
        recovered: sql<number>`coalesce(sum(${feeRows.amount}) filter (where ${feeRows.status} = 'paid'), 0)::int`,
        unpaidCount: sql<number>`count(*) filter (where ${feeRows.status} = 'unpaid')::int`,
      })
      .from(feeRows)
      .innerJoin(classes, eq(classes.id, feeRows.classId))
      .where(and(eq(feeRows.academyId, a), eq(feeRows.month, month)))
      .groupBy(classes.id, classes.name, classes.level)
      .orderBy(asc(classes.level), asc(classes.name)),
    // FR-FEE-11: revenue at current fees (not tied to rows)
    db
      .select({
        total: sql<number>`coalesce(sum(coalesce(sf.monthly_fee, cf.monthly_fee, 0)), 0)::int`,
        notSet: sql<number>`count(*) filter (where sf.monthly_fee is null and cf.monthly_fee is null)::int`,
      })
      .from(students)
      .innerJoin(enrollments, and(eq(enrollments.studentId, students.id), isNull(enrollments.toDate)))
      .leftJoin(sql`${studentFees} sf`, sql`sf.student_id = ${students.id}`)
      .leftJoin(sql`${classFees} cf`, sql`cf.class_id = ${enrollments.classId}`)
      .where(and(eq(students.academyId, a), eq(students.status, "active"))),
    db
      .select({
        rowId: feeRows.id,
        studentId: students.id,
        name: students.name,
        className: classes.name,
        amount: feeRows.amount,
        monthsUnpaid: sql<number>`(select count(*)::int from ${feeRows} f2 where f2.student_id = ${students.id} and f2.status = 'unpaid')`,
      })
      .from(feeRows)
      .innerJoin(students, eq(students.id, feeRows.studentId))
      .innerJoin(classes, eq(classes.id, feeRows.classId))
      .where(and(eq(feeRows.academyId, a), eq(feeRows.month, month), eq(feeRows.status, "unpaid")))
      .orderBy(desc(feeRows.amount), asc(students.name))
      .limit(100),
  ]);
  const expected = agg?.expected ?? 0;
  const recovered = agg?.recovered ?? 0;
  return {
    month,
    asOf: new Date(),
    activeStudents: active?.n ?? 0,
    expected,
    recovered,
    pending: expected - recovered,
    recoveryPct: expected > 0 ? Math.round((recovered / expected) * 1000) / 10 : null,
    waivedAmount: agg?.waived ?? 0,
    counts: { paid: agg?.paidCount ?? 0, unpaid: agg?.unpaidCount ?? 0, waived: agg?.waivedCount ?? 0, total: agg?.rows ?? 0 },
    byClass: byClass.map((c) => ({ ...c, pending: c.expected - c.recovered })),
    revenueAtCurrentFees: atCurrent?.total ?? 0,
    feeNotSetCount: atCurrent?.notSet ?? 0,
    unpaid: unpaidList,
  };
}

export async function financeTrend(ctx: Ctx, months = 12) {
  assertOwner(ctx);
  const to = currentMonth();
  const from = addMonths(to, -(months - 1));
  const rows = await db
    .select({
      month: sql<string>`${feeRows.month}::text`,
      expected: sql<number>`coalesce(sum(${feeRows.amount}) filter (where ${feeRows.status} <> 'waived'), 0)::int`,
      recovered: sql<number>`coalesce(sum(${feeRows.amount}) filter (where ${feeRows.status} = 'paid'), 0)::int`,
    })
    .from(feeRows)
    .where(and(eq(feeRows.academyId, ctx.academyId), sql`${feeRows.month} between ${from}::date and ${to}::date`))
    .groupBy(feeRows.month)
    .orderBy(asc(feeRows.month));
  const out: { month: string; expected: number; recovered: number }[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(rows.find((r) => r.month === m) ?? { month: m, expected: 0, recovered: 0 });
  return out;
}

/** Fee settings screen data (Super Admin). */
export async function feeSettingsData(ctx: Ctx) {
  assertOwner(ctx);
  const year = await requireCurrentYear(ctx.academyId);
  const [cls, personal] = await Promise.all([
    db
      .select({
        id: classes.id,
        name: classes.name,
        monthlyFee: classFees.monthlyFee,
        students: sql<number>`(select count(*)::int from ${enrollments} e where e.class_id = "classes"."id" and e.to_date is null)`,
      })
      .from(classes)
      .leftJoin(classFees, eq(classFees.classId, classes.id))
      .where(and(eq(classes.academicYearId, year.id), isNull(classes.archivedAt)))
      .orderBy(asc(classes.level), asc(classes.name)),
    db
      .select({
        studentId: students.id,
        name: students.name,
        registrationNo: students.registrationNo,
        monthlyFee: studentFees.monthlyFee,
        note: studentFees.note,
        className: classes.name,
        classFee: classFees.monthlyFee,
      })
      .from(studentFees)
      .innerJoin(students, eq(students.id, studentFees.studentId))
      .leftJoin(enrollments, and(eq(enrollments.studentId, students.id), isNull(enrollments.toDate)))
      .leftJoin(classes, eq(classes.id, enrollments.classId))
      .leftJoin(classFees, eq(classFees.classId, enrollments.classId))
      .where(and(eq(students.academyId, ctx.academyId), ne(students.status, "removed")))
      .orderBy(asc(students.name)),
  ]);
  return { classes: cls, personal };
}

/** Months offered in pickers: academic-year start (or 11 months back) … current month. */
export async function monthOptions(academyId: string): Promise<string[]> {
  const year = await requireCurrentYear(academyId);
  const cur = currentMonth();
  const start = monthStart(year.startDate) > addMonths(cur, -11) ? monthStart(year.startDate) : addMonths(cur, -11);
  const out: string[] = [];
  for (let m = cur; m >= start; m = addMonths(m, -1)) out.push(m);
  return out;
}

/** Student-level read used by the profile Fees tab (FR-STU-10). */
export async function studentFeeRows(ctx: Ctx, studentId: string) {
  await assertStudentVisible(ctx, studentId);
  const rows = await db
    .select({
      id: feeRows.id,
      month: feeRows.month,
      className: classes.name,
      status: feeRows.status,
      amount: feeRows.amount,
      markedAt: feeRows.markedAt,
      markedByName: users.name,
      note: feeRows.note,
      waiveReason: feeRows.waiveReason,
    })
    .from(feeRows)
    .innerJoin(classes, eq(classes.id, feeRows.classId))
    .leftJoin(users, eq(users.id, feeRows.markedBy))
    .where(eq(feeRows.studentId, studentId))
    .orderBy(desc(feeRows.month));
  const amounts = seesFeeAmounts(ctx);
  return rows.map(({ amount, markedByName, ...r }) => ({
    ...r,
    ...(amounts ? { amount } : {}),
    markedByName: ctx.role === "parent" ? null : markedByName,
  })) as { id: string; month: string; className: string; status: "paid" | "unpaid" | "waived"; amount?: number; markedAt: Date | null; markedByName: string | null; note: string | null; waiveReason: string | null }[];
}

