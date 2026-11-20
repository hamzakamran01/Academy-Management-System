import "server-only";
import { and, eq, isNull, isNotNull, or, sql } from "drizzle-orm";
import type { Tx } from "@/server/db";
import { enrollments, feeRows, studentFees } from "@/server/db/schema";

/** BR-FEE-03: create this month's row on join / re-admit if none exists (idempotent). */
export async function ensureFeeRow(tx: Tx, academyId: string, studentId: string, classId: string, month: string): Promise<boolean> {
  const [fee] = await tx.select({ amount: studentFees.monthlyFee, paperAmount: studentFees.paperFee }).from(studentFees).where(eq(studentFees.studentId, studentId));
  if (!fee) return false;
  const inserted = await tx
    .insert(feeRows)
    .values({ academyId, studentId, classId, month, ...fee })
    .onConflictDoNothing({ target: [feeRows.studentId, feeRows.month] })
    .returning({ id: feeRows.id });
  return inserted.length > 0;
}

/** Months still unpaid for a student — used for the removal warning (FR-STU-06). */
export async function unpaidMonths(tx: Tx, studentId: string): Promise<string[]> {
  const rows = await tx
    .select({ month: feeRows.month })
    .from(feeRows)
    .where(and(eq(feeRows.studentId, studentId), or(eq(feeRows.status, "unpaid"), and(isNotNull(feeRows.paperAmount), isNull(feeRows.paperPaidAt)))))
    .orderBy(feeRows.month);
  return rows.map((r) => r.month);
}

/** Current open class of a student, if any. */
export async function openEnrollment(tx: Tx, studentId: string) {
  const [row] = await tx.select().from(enrollments).where(and(eq(enrollments.studentId, studentId), isNull(enrollments.toDate)));
  return row ?? null;
}

export const hasHistorySql = (studentId: string) => sql`(
  exists (select 1 from attendance_marks where student_id = ${studentId})
  or exists (select 1 from marks where student_id = ${studentId})
  or exists (select 1 from fee_rows where student_id = ${studentId} and (status <> 'unpaid' or paper_paid_at is not null))
)`;
