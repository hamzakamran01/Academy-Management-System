import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { salaryRows } from "@/server/db/schema";
import { addMonths, monthStart, todayPkt } from "@/lib/dates";
import type { Ctx } from "@/server/auth/session";
import { generateSalaryRows, markSalary, mySalary, netForMonth, salariesOverview, setSalary } from "@/server/modules/salaries";
import { teacherProfile } from "@/server/modules/users";
import { makeAcademy, makeUser } from "./fixtures";

/** SRS §11.2 test 5 — salary privacy; BR-SAL-01…06. */
describe("salaries", () => {
  const month = monthStart(todayPkt());
  let owner: Ctx, admin: Ctx, teacherA: Ctx, teacherB: Ctx;

  beforeAll(async () => {
    const { academyId } = await makeAcademy();
    owner = await makeUser(academyId, "super_admin");
    admin = await makeUser(academyId, "admin");
    teacherA = await makeUser(academyId, "teacher", "Teacher A");
    teacherB = await makeUser(academyId, "teacher", "Teacher B");
    await setSalary(owner, teacherA.userId, 60_000, month);
    await setSalary(owner, teacherB.userId, 45_000, month);
  });

  it("only the owner can set or see salaries", async () => {
    await expect(setSalary(admin, teacherA.userId, 1, month)).rejects.toMatchObject({ status: 403 });
    await expect(salariesOverview(admin, month)).rejects.toMatchObject({ status: 403 });
    await expect(salariesOverview(teacherA, month)).rejects.toMatchObject({ status: 403 });
    await expect(netForMonth(admin, month)).rejects.toMatchObject({ status: 403 });
  });

  it("admin's teacher profile has no salary fields (FR-SAL-04)", async () => {
    const p = await teacherProfile(admin, teacherA.userId);
    expect(JSON.stringify(p)).not.toMatch(/salary/i);
  });

  it("generates monthly rows idempotently (BR-SAL-02)", async () => {
    expect((await generateSalaryRows(owner.academyId, month, owner)).created).toBe(2);
    expect((await generateSalaryRows(owner.academyId, month, owner)).created).toBe(0);
  });

  it("a teacher sees only their own salary (BR-SAL-05)", async () => {
    const mine = await mySalary(teacherA);
    expect(mine.current?.amount).toBe(60_000);
    expect(mine.rows).toHaveLength(1);
    expect(mine.rows.every((r) => r.amount === 60_000)).toBe(true);
    await expect(mySalary(await makeUser(owner.academyId, "parent"))).rejects.toMatchObject({ status: 403 });
  });

  it("change from this month updates a pending row; paid rows never change (BR-SAL-03)", async () => {
    const [rowB] = await db.select().from(salaryRows).where(and(eq(salaryRows.userId, teacherB.userId), eq(salaryRows.month, month)));
    await markSalary(owner, rowB!.id, "paid");
    await setSalary(owner, teacherB.userId, 50_000, month);
    await setSalary(owner, teacherA.userId, 65_000, month);
    const after = await salariesOverview(owner, month);
    expect(after.items.find((i) => i.userId === teacherB.userId)!.row!.amount).toBe(45_000);
    expect(after.items.find((i) => i.userId === teacherA.userId)!.row!.amount).toBe(65_000);
    expect(after.totals).toMatchObject({ bill: 110_000, paid: 45_000, pending: 65_000 });
    // a future raise doesn't touch this month
    await setSalary(owner, teacherA.userId, 70_000, addMonths(month, 1));
    expect((await salariesOverview(owner, month)).items.find((i) => i.userId === teacherA.userId)!.salary).toBe(65_000);
  });

  it("net = recovered − salaries paid (BR-SAL-06)", async () => {
    const n = await netForMonth(owner, month);
    expect(n).toMatchObject({ salaryBill: 110_000, salaryPaid: 45_000, net: -45_000, plannedNet: -110_000 });
  });
});
