import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { feeStatusEnum, id, salaryStatusEnum, timestamps, ts } from "./_shared";
import { users } from "./auth";
import { academy, classes } from "./org";
import { students } from "./students";

// ─── Fees (money = integer rupees, SRS C4) ──────────────────────────────────
export const classFees = pgTable(
  "class_fees",
  {
    id: id(),
    classId: uuid("class_id").notNull().references(() => classes.id),
    monthlyFee: integer("monthly_fee").notNull(),
    setBy: uuid("set_by").notNull().references(() => users.id),
    setAt: ts("set_at").notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("class_fees_class_uq").on(t.classId), check("class_fees_amount_ck", sql`${t.monthlyFee} >= 0`)],
);

export const studentFees = pgTable(
  "student_fees",
  {
    id: id(),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    monthlyFee: integer("monthly_fee").notNull(),
    note: text("note"),
    setBy: uuid("set_by").notNull().references(() => users.id),
    setAt: ts("set_at").notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("student_fees_student_uq").on(t.studentId), check("student_fees_amount_ck", sql`${t.monthlyFee} >= 0`)],
);

export const feeRows = pgTable(
  "fee_rows",
  {
    id: id(),
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id").notNull().references(() => classes.id),
    month: date("month").notNull(), // first day of month
    amount: integer("amount").notNull(),
    status: feeStatusEnum("status").notNull().default("unpaid"),
    markedBy: uuid("marked_by").references(() => users.id),
    markedAt: ts("marked_at"),
    note: text("note"),
    waiveReason: text("waive_reason"),
    version: integer("version").notNull().default(1),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("fee_rows_student_month_uq").on(t.studentId, t.month),
    index("fee_rows_month_status_idx").on(t.month, t.status),
    index("fee_rows_class_month_idx").on(t.classId, t.month),
    check("fee_rows_amount_ck", sql`${t.amount} >= 0`),
    check("fee_rows_month_ck", sql`extract(day from ${t.month}) = 1`),
  ],
);

// ─── Salaries ───────────────────────────────────────────────────────────────
export const salarySettings = pgTable(
  "salary_settings",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    monthlySalary: integer("monthly_salary").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    setBy: uuid("set_by").notNull().references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("salary_settings_user_month_uq").on(t.userId, t.effectiveFrom),
    check("salary_settings_amount_ck", sql`${t.monthlySalary} >= 0`),
    check("salary_settings_month_ck", sql`extract(day from ${t.effectiveFrom}) = 1`),
  ],
);

export const salaryRows = pgTable(
  "salary_rows",
  {
    id: id(),
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    month: date("month").notNull(),
    amount: integer("amount").notNull(),
    status: salaryStatusEnum("status").notNull().default("pending"),
    paidOn: date("paid_on"),
    note: text("note"),
    markedBy: uuid("marked_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("salary_rows_user_month_uq").on(t.userId, t.month),
    index("salary_rows_month_idx").on(t.month, t.status),
    check("salary_rows_amount_ck", sql`${t.amount} >= 0`),
  ],
);
