import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { classes, feeRows, users } from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { assertStudentVisible } from "@/server/policy/scope";

/** Amounts are visible to Super Admin, Admin and the student's parents — never teachers (SRS §5.4). */
export const seesFeeAmounts = (ctx: Ctx) => ctx.role !== "teacher";

export type StudentFeeRow = {
  id: string;
  month: string;
  className: string;
  status: "paid" | "unpaid" | "waived";
  amount?: number;
  markedAt: Date | null;
  markedByName: string | null;
  note: string | null;
  waiveReason: string | null;
};

/** Month-by-month fee status for one student (FR-FEE-12, FR-STU-10). */
export async function studentFeeRows(ctx: Ctx, studentId: string): Promise<StudentFeeRow[]> {
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
    // Parents see the date, not which staff member marked it.
    markedByName: ctx.role === "parent" ? null : markedByName,
  }));
}
