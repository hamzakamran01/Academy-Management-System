import { date, index, integer, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { attendanceStatusEnum, id, timestamps, ts } from "./_shared";
import { users } from "./auth";
import { classes } from "./org";
import { students } from "./students";

export const attendanceDays = pgTable(
  "attendance_days",
  {
    id: id(),
    classId: uuid("class_id").notNull().references(() => classes.id),
    date: date("date").notNull(),
    markedBy: uuid("marked_by").notNull().references(() => users.id),
    markedAt: ts("marked_at").notNull().defaultNow(),
    version: integer("version").notNull().default(1),
    ...timestamps(),
  },
  (t) => [uniqueIndex("attendance_days_uq").on(t.classId, t.date)],
);

export const attendanceMarks = pgTable(
  "attendance_marks",
  {
    id: id(),
    attendanceDayId: uuid("attendance_day_id").notNull().references(() => attendanceDays.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("attendance_marks_uq").on(t.attendanceDayId, t.studentId),
    index("attendance_marks_student_idx").on(t.studentId),
  ],
);
