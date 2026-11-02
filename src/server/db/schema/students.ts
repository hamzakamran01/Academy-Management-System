import { sql } from "drizzle-orm";
import { date, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { genderEnum, id, relationEnum, removalReasonEnum, studentStatusEnum, timestamps } from "./_shared";
import { users } from "./auth";
import { academy, classes, classSubjects } from "./org";

export const students = pgTable(
  "students",
  {
    id: id(),
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    registrationNo: text("registration_no").notNull(),
    name: text("name").notNull(),
    guardianName: text("guardian_name").notNull(),
    gender: genderEnum("gender").notNull(),
    dob: date("dob"),
    photoKey: text("photo_key"),
    address: text("address"),
    notes: text("notes"),
    admissionDate: date("admission_date").notNull(),
    status: studentStatusEnum("status").notNull().default("active"),
    removedReason: removalReasonEnum("removed_reason"),
    removedNote: text("removed_note"),
    removedOn: date("removed_on"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("students_reg_uq").on(t.academyId, t.registrationNo),
    index("students_status_idx").on(t.academyId, t.status),
    // Trigram search on name (SRS §4.3) — requires pg_trgm, enabled in migration 0000.
    index("students_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
  ],
);

export const parentLinks = pgTable(
  "parent_links",
  {
    id: id(),
    parentUserId: uuid("parent_user_id").notNull().references(() => users.id),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    relation: relationEnum("relation").notNull().default("guardian"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("parent_links_uq").on(t.parentUserId, t.studentId),
    index("parent_links_student_idx").on(t.studentId),
  ],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id").notNull().references(() => classes.id),
    rollNo: text("roll_no").notNull(),
    fromDate: date("from_date").notNull(),
    toDate: date("to_date"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("enrollments_open_student_uq").on(t.studentId).where(sql`${t.toDate} is null`),
    uniqueIndex("enrollments_open_roll_uq").on(t.classId, t.rollNo).where(sql`${t.toDate} is null`),
    index("enrollments_class_open_idx").on(t.classId).where(sql`${t.toDate} is null`),
    index("enrollments_class_range_idx").on(t.classId, t.fromDate, t.toDate),
  ],
);

export const studentSubjectExclusions = pgTable(
  "student_subject_exclusions",
  {
    id: id(),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    classSubjectId: uuid("class_subject_id").notNull().references(() => classSubjects.id),
    ...timestamps(),
  },
  (t) => [uniqueIndex("sse_uq").on(t.enrollmentId, t.classSubjectId), index("sse_cs_idx").on(t.classSubjectId)],
);
