import "server-only";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { feeRows, roleAssignments, salaryRows, salarySettings, users } from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { rows as execRows } from "@/server/db/connect";
import { addMonths, monthStart, todayPkt } from "@/lib/dates";
import { formatMonth } from "@/lib/format";
import { badRequest, forbidden, notFound } from "@/server/http";
import { logActivity } from "./audit";
import { queueNotifications } from "./notify";

/**
 * Salaries are the most sensitive data in the system (FR-SAL-03/04, BR-SAL-05):
 * every function here is Super Admin only, except `mySalary` (self only).
 * No other module ever reads these tables.
 */
const assertOwner = (ctx: Ctx) => {
  if (ctx.role !== "super_admin") throw forbidden();
};
const currentMonth = () => monthStart(todayPkt());

/** BR-SAL-01: latest setting with effective_from ≤ month. */
async function effectiveSalary(tx: Tx, userId: string, month: string): Promise<number | null> {
  const [row] = await tx
    .select({ amount: salarySettings.monthlySalary })
    .from(salarySettings)
    .where(and(eq(salarySettings.userId, userId), lte(salarySettings.effectiveFrom, month)))
    .orderBy(desc(salarySettings.effectiveFrom))
    .limit(1);
  return row?.amount ?? null;
}

/** FR-SAL-01 / BR-SAL-03 */
export async function setSalary(ctx: Ctx, userId: string, amount: number, effectiveFrom: string) {
  assertOwner(ctx);
  if (monthStart(effectiveFrom) !== effectiveFrom) throw badRequest("BAD_MONTH", "Pick a month");
  if (effectiveFrom < addMonths(currentMonth(), -1)) throw badRequest("PAST_MONTH", "Salary changes can start this month or later", { fields: { effectiveFrom: "Choose this month or later" } });
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ name: users.name, academyId: users.academyId }).from(users).where(eq(users.id, userId));
    if (!u || u.academyId !== ctx.academyId) throw notFound("Staff member");
    const before = await effectiveSalary(tx, userId, effectiveFrom);
    await tx
      .insert(salarySettings)
      .values({ userId, monthlySalary: amount, effectiveFrom, setBy: ctx.userId })
      .onConflictDoUpdate({ target: [salarySettings.userId, salarySettings.effectiveFrom], set: { monthlySalary: amount, setBy: ctx.userId, updatedAt: new Date() } });
    // BR-SAL-03: if it starts this month, a pending row for this month follows; paid rows never change.
    let updated = false;
    if (effectiveFrom <= currentMonth()) {
      const res = await tx
        .update(salaryRows)
        .set({ amount })
        .where(and(eq(salaryRows.userId, userId), eq(salaryRows.month, currentMonth()), eq(salaryRows.status, "pending")))
        .returning({ id: salaryRows.id });
      updated = res.length > 0;
    }
    await logActivity(tx, ctx, {
      action: "salary.set",
      entityType: "user",
      entityId: userId,
      summary: `Set salary of ${u.name} from ${formatMonth(effectiveFrom)}`,
      before: { monthlySalary: before },
      after: { monthlySalary: amount, effectiveFrom, updatedCurrentRow: updated },
      sensitivity: "salary",
    });
  });
}

/** BR-SAL-02: rows for every active teacher (and staff with a salary setting). Idempotent. */
export async function generateSalaryRows(academyId: string, month: string, actor: Ctx | null) {
  if (monthStart(month) !== month) throw badRequest("BAD_MONTH", "Pick a month");
  return db.transaction(async (tx) => {
    const created = await execRows<{ id: string }>(
      tx as never,
      sql`
        insert into salary_rows (academy_id, user_id, month, amount)
        select u.academy_id, u.id, ${month}::date, s.monthly_salary
        from users u
        join lateral (
          select ss.monthly_salary from salary_settings ss
          where ss.user_id = u.id and ss.effective_from <= ${month}::date
          order by ss.effective_from desc limit 1
        ) s on true
        where u.academy_id = ${academyId} and u.status = 'active'
          and exists (select 1 from role_assignments r where r.user_id = u.id and r.active and r.role in ('teacher', 'admin'))
        on conflict (user_id, month) do nothing
        returning id`,
    );
    if (actor) {
      await logActivity(tx, actor, { action: "salary.generate", entityType: "salary_month", summary: `Created ${formatMonth(month)} salary list (${created.length} new)`, sensitivity: "salary" });
    }
    return { created: created.length };
  });
}

/** BR-SAL-04: owner marks paid (date, note) or reverts to pending; teacher notified on paid. */
export async function markSalary(ctx: Ctx, rowId: string, to: "paid" | "pending", paidOn?: string | null, note?: string | null) {
  assertOwner(ctx);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ r: salaryRows, name: users.name })
      .from(salaryRows)
      .innerJoin(users, eq(users.id, salaryRows.userId))
      .where(and(eq(salaryRows.id, rowId), eq(salaryRows.academyId, ctx.academyId)));
    if (!row) throw notFound("Salary row");
    if (row.r.status === to) return;
    await tx
      .update(salaryRows)
      .set({ status: to, paidOn: to === "paid" ? (paidOn ?? todayPkt()) : null, note: note ?? row.r.note, markedBy: ctx.userId })
      .where(eq(salaryRows.id, rowId));
    await logActivity(tx, ctx, {
      action: to === "paid" ? "salary.mark_paid" : "salary.mark_pending",
      entityType: "salary_row",
      entityId: rowId,
      summary: `${to === "paid" ? "Paid" : "Reverted"} ${formatMonth(row.r.month)} salary of ${row.name}`,
      sensitivity: "salary",
    });
    if (to === "paid") {
      const [role] = await tx.select({ role: roleAssignments.role }).from(roleAssignments).where(and(eq(roleAssignments.userId, row.r.userId), eq(roleAssignments.active, true), inArray(roleAssignments.role, ["teacher", "admin"])));
      if (role) {
        await queueNotifications(tx, [
          { userId: row.r.userId, role: role.role, type: "salary.paid", title: `${formatMonth(row.r.month)} salary paid`, body: `Your salary for ${formatMonth(row.r.month)} has been marked paid.`, pushText: "Salary update — tap to view", link: "/my-salary" },
        ]);
      }
    }
  });
}

/** FR-SAL-05: all staff with salary and this month's status; totals. */
export async function salariesOverview(ctx: Ctx, month: string) {
  assertOwner(ctx);
  const staff = await db
    .select({
      userId: users.id,
      name: users.name,
      roles: sql<string[]>`array_agg(distinct ${roleAssignments.role}::text)`,
      salary: sql<number | null>`(select ss.monthly_salary from ${salarySettings} ss where ss.user_id = ${users.id} and ss.effective_from <= ${month}::date order by ss.effective_from desc limit 1)`,
      nextChange: sql<string | null>`(select ss.effective_from::text from ${salarySettings} ss where ss.user_id = ${users.id} and ss.effective_from > ${month}::date order by ss.effective_from limit 1)`,
    })
    .from(users)
    .innerJoin(roleAssignments, and(eq(roleAssignments.userId, users.id), eq(roleAssignments.active, true), inArray(roleAssignments.role, ["teacher", "admin"])))
    .where(and(eq(users.academyId, ctx.academyId), eq(users.status, "active")))
    .groupBy(users.id)
    .orderBy(asc(users.name));
  const rows = await db.select().from(salaryRows).where(and(eq(salaryRows.academyId, ctx.academyId), eq(salaryRows.month, month)));
  const items = staff.map((s) => {
    const r = rows.find((x) => x.userId === s.userId);
    return { ...s, row: r ? { id: r.id, amount: r.amount, status: r.status, paidOn: r.paidOn, note: r.note } : null };
  });
  const bill = rows.reduce((n, r) => n + r.amount, 0);
  const paid = rows.filter((r) => r.status === "paid").reduce((n, r) => n + r.amount, 0);
  return { month, items, totals: { bill, paid, pending: bill - paid, generated: rows.length > 0, notSet: staff.filter((s) => s.salary == null).length } };
}

/** BR-SAL-06: net = recovered − salaries paid; planned net = expected − all salary rows. */
export async function netForMonth(ctx: Ctx, month: string) {
  assertOwner(ctx);
  const [f] = await db
    .select({
      expected: sql<number>`coalesce(sum(${feeRows.amount}) filter (where ${feeRows.status} <> 'waived'), 0)::int`,
      recovered: sql<number>`coalesce(sum(${feeRows.amount}) filter (where ${feeRows.status} = 'paid'), 0)::int`,
    })
    .from(feeRows)
    .where(and(eq(feeRows.academyId, ctx.academyId), eq(feeRows.month, month)));
  const [s] = await db
    .select({
      total: sql<number>`coalesce(sum(${salaryRows.amount}), 0)::int`,
      paid: sql<number>`coalesce(sum(${salaryRows.amount}) filter (where ${salaryRows.status} = 'paid'), 0)::int`,
    })
    .from(salaryRows)
    .where(and(eq(salaryRows.academyId, ctx.academyId), eq(salaryRows.month, month)));
  return {
    salaryBill: s?.total ?? 0,
    salaryPaid: s?.paid ?? 0,
    salaryPending: (s?.total ?? 0) - (s?.paid ?? 0),
    net: (f?.recovered ?? 0) - (s?.paid ?? 0),
    plannedNet: (f?.expected ?? 0) - (s?.total ?? 0),
  };
}

/** FR-SAL-03 / BR-SAL-05: only ever the signed-in user's own rows. */
export async function mySalary(ctx: Ctx) {
  if (ctx.role !== "teacher" && ctx.role !== "admin") throw forbidden();
  const [current] = await db
    .select({ amount: salarySettings.monthlySalary, from: salarySettings.effectiveFrom })
    .from(salarySettings)
    .where(and(eq(salarySettings.userId, ctx.userId), lte(salarySettings.effectiveFrom, currentMonth())))
    .orderBy(desc(salarySettings.effectiveFrom))
    .limit(1);
  const rows = await db
    .select({ id: salaryRows.id, month: salaryRows.month, amount: salaryRows.amount, status: salaryRows.status, paidOn: salaryRows.paidOn })
    .from(salaryRows)
    .where(eq(salaryRows.userId, ctx.userId))
    .orderBy(desc(salaryRows.month))
    .limit(24);
  return { current: current ?? null, rows };
}
