import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { assessmentStatusEnum, assessmentTypeEnum, id, timestamps, ts } from "./_shared";
import { users } from "./auth";
import { academy, classes, classSubjects } from "./org";
import { students } from "./students";

/** An exam created for a whole class — fans out to one assessment per subject (BR-RES-10). */
export const examGroups = pgTable("exam_groups", {
  id: id(),
  academyId: uuid("academy_id").notNull().references(() => academy.id),
  classId: uuid("class_id").notNull().references(() => classes.id),
  type: assessmentTypeEnum("type").notNull(),
  title: text("title").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...timestamps(),
});

export const assessments = pgTable(
  "assessments",
  {
    id: id(),
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    classSubjectId: uuid("class_subject_id").notNull().references(() => classSubjects.id),
    examGroupId: uuid("exam_group_id").references(() => examGroups.id),
    type: assessmentTypeEnum("type").notNull(),
    title: text("title").notNull(),
    date: date("date").notNull(),
    totalMarks: numeric("total_marks", { precision: 5, scale: 1, mode: "number" }).notNull(),
    chapterIds: uuid("chapter_ids").array().notNull().default(sql`'{}'::uuid[]`),
    status: assessmentStatusEnum("status").notNull().default("draft"),
    publishedAt: ts("published_at"),
    publishedBy: uuid("published_by").references(() => users.id),
    unlockReason: text("unlock_reason"),
    correctedAt: ts("corrected_at"),
    correctionRequestedAt: ts("correction_requested_at"),
    correctionRequestNote: text("correction_request_note"),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    version: integer("version").notNull().default(1),
    ...timestamps(),
  },
  (t) => [
    index("assessments_cs_idx").on(t.classSubjectId, t.date),
    index("assessments_status_idx").on(t.academyId, t.status),
    check("assessments_total_ck", sql`${t.totalMarks} > 0`),
  ],
);

export const marks = pgTable(
  "marks",
  {
    id: id(),
    assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    value: numeric("value", { precision: 5, scale: 1, mode: "number" }),
    isAbsent: boolean("is_absent").notNull().default(false),
    updatedBy: uuid("updated_by").notNull().references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("marks_uq").on(t.assessmentId, t.studentId),
    index("marks_student_idx").on(t.studentId),
    check("marks_value_ck", sql`${t.value} is null or (${t.value} >= 0 and mod(${t.value} * 2, 1) = 0)`),
    check("marks_absent_ck", sql`not (${t.isAbsent} and ${t.value} is not null)`),
  ],
);
