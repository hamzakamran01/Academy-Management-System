import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { feeRows, studentFees } from "@/server/db/schema";
import { addMonths, monthStart, todayPkt } from "@/lib/dates";
import type { Ctx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import {
  classFeeList,
  feeOverview,
  financeSummary,
  generateMonthRows,
  markFee,
  setStudentFee,
  waiveFee,
} from "@/server/modules/fees";
import { makeAcademy, makeClass, makeStudent, makeUser } from "./fixtures";

/**
 * PRD §6.7 acceptance + SRS §11.2 tests 1–4.
 * 40 students, effective fees total Rs 228,000; 31 paid totalling Rs 176,500;
 * 1 waived (Rs 6,000) → Expected 222,000 · Recovered 176,500 · Pending 45,500 · 79.5%.
 */
describe("fees", () => {
  const month = monthStart(todayPkt());
  let owner: Ctx, admin: Ctx, teacher: Ctx;
  let classId: string, otherClassId: string;
  const ids: string[] = [];
  let aliId = "";
  let otherStudentId = "";

  beforeAll(async () => {
    const { academyId, yearId } = await makeAcademy();
    owner = await makeUser(academyId, "super_admin", "Owner");
    admin = await makeUser(academyId, "admin", "Admin");
    teacher = await makeUser(academyId, "teacher", "Class Teacher");

    classId = (await makeClass(academyId, yearId, "9-A", { fee: 6000, setBy: owner.userId })).id;
    otherClassId = (await makeClass(academyId, yearId, "9-B", { fee: 6000, setBy: owner.userId })).id;

    for (let i = 1; i <= 40; i++) ids.push((await makeStudent(academyId, classId, i, i === 1 ? "Ali" : `S${i}`)).id);
    aliId = ids[0]!;
    otherStudentId = (await makeStudent(academyId, otherClassId, 1, "Other")).id;

    // Personal fees: Ali 4500, two at 2000, one at 3500 → total 36×6000 + 4500 + 2000 + 2000 + 3500 = 228,000
    await setStudentFee(owner, aliId, 4500, "Sibling discount", false);
    await setStudentFee(owner, ids[1]!, 2000, null, false);
    await setStudentFee(owner, ids[2]!, 2000, null, false);
    await setStudentFee(owner, ids[39]!, 3500, null, false);
  });

  it("creates monthly rows idempotently (BR-FEE-02)", async () => {
    const first = await generateMonthRows(owner.academyId, month, owner);
    expect(first.created).toBe(41);
    const second = await generateMonthRows(owner.academyId, month, owner);
    expect(second.created).toBe(0);
    expect(second.total).toBe(41);
  });

  it("snapshots the effective fee (personal > class)", async () => {
    const [ali] = await db.select().from(feeRows).where(and(eq(feeRows.studentId, aliId), eq(feeRows.month, month)));
    expect(ali!.amount).toBe(4500);
  });

  it("computes finance totals exactly (PRD §6.7 example)", async () => {
    const list = await classFeeList(admin, classId, month);
    const byStudent = new Map(list.rows.map((r) => [r.studentId, r.id]));
    // Paid: Ali (4500), the two 2000s, and 28 students at 6000 (ids 4..31) = 31 rows, Rs 176,500
    const paid = [aliId, ids[1]!, ids[2]!, ...ids.slice(3, 31)];
    expect(paid).toHaveLength(31);
    for (const sid of paid) await markFee(admin, byStudent.get(sid)!, "paid");
    // Waive one Rs 6,000 month
    await waiveFee(owner, byStudent.get(ids[31]!)!, "Hardship");

    const f = await financeSummary(owner, month);
    // the other class's single unpaid student adds 6000 to expected/pending — remove it from the comparison
    const cls = f.byClass.find((c) => c.classId === classId)!;
    expect(cls.expected).toBe(222_000);
    expect(cls.recovered).toBe(176_500);
    expect(cls.pending).toBe(45_500);
    expect(Math.round((cls.recovered / cls.expected) * 1000) / 10).toBe(79.5);
    expect(f.expected).toBe(222_000 + 6000);
    expect(f.recovered).toBe(176_500);
  });

  it("keeps fee status away from teachers entirely — the office enforces fees", async () => {
    const [row] = await db.select().from(feeRows).where(eq(feeRows.studentId, aliId));
    await expect(classFeeList(teacher, classId, month)).rejects.toMatchObject({ status: 403 });
    await expect(feeOverview(teacher, month)).rejects.toMatchObject({ status: 403 });
    await expect(markFee(teacher, row!.id, "paid")).rejects.toMatchObject({ status: 403 });
  });

  it("blocks teachers outside their classes and non-owners from finance", async () => {
    const [row] = await db.select().from(feeRows).where(eq(feeRows.studentId, otherStudentId));
    await expect(markFee(teacher, row!.id, "paid")).rejects.toMatchObject({ status: 403 });
    await expect(classFeeList(teacher, otherClassId, month)).rejects.toBeInstanceOf(ApiError);
    await expect(financeSummary(admin, month)).rejects.toMatchObject({ status: 403 });
    await expect(waiveFee(admin, row!.id, "x")).rejects.toMatchObject({ status: 403 });
    await expect(setStudentFee(admin, otherStudentId, 1, null, false)).rejects.toMatchObject({ status: 403 });
  });

  it("applies fee changes from next month unless 'also this month' (BR-FEE-04)", async () => {
    // Ali is paid this month → never changes, even with alsoThisMonth
    await setStudentFee(owner, aliId, 5000, null, true);
    const [aliNow] = await db.select().from(feeRows).where(and(eq(feeRows.studentId, aliId), eq(feeRows.month, month)));
    expect(aliNow!.amount).toBe(4500);

    // S40 is unpaid → without the flag stays 3500, with the flag follows the new fee
    const s40 = ids[39]!;
    await setStudentFee(owner, s40, 3000, null, false);
    let [r] = await db.select().from(feeRows).where(and(eq(feeRows.studentId, s40), eq(feeRows.month, month)));
    expect(r!.amount).toBe(3500);
    await setStudentFee(owner, s40, 3000, null, true);
    [r] = await db.select().from(feeRows).where(and(eq(feeRows.studentId, s40), eq(feeRows.month, month)));
    expect(r!.amount).toBe(3000);

    // Next month picks up the new personal fee
    const next = addMonths(month, 1);
    await generateMonthRows(owner.academyId, next, owner);
    const [aliNext] = await db.select().from(feeRows).where(and(eq(feeRows.studentId, aliId), eq(feeRows.month, next)));
    expect(aliNext!.amount).toBe(5000);
    await db.delete(feeRows).where(eq(feeRows.month, next));
    expect((await db.select().from(studentFees).where(eq(studentFees.studentId, aliId)))[0]!.monthlyFee).toBe(5000);
  });

  it("marks back to unpaid and is idempotent", async () => {
    const [row] = await db.select().from(feeRows).where(and(eq(feeRows.studentId, ids[5]!), eq(feeRows.month, month)));
    const a = await markFee(admin, row!.id, "unpaid");
    expect(a.status).toBe("unpaid");
    const b = await markFee(admin, row!.id, "unpaid");
    expect(b.version).toBe(a.version);
    const c = await markFee(admin, row!.id, "paid");
    expect(c.status).toBe("paid");
  });
});
