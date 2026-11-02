import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, pgTable, primaryKey, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AcademySettings } from "@/lib/settings";
import { id, timestamps, ts } from "./_shared";
import { users } from "./auth";

export const academy = pgTable("academy", {
  id: id(),
  name: text("name").notNull(),
  logoKey: text("logo_key"),
  address: text("address"),
  phone: text("phone"),
  settings: jsonb("settings").$type<Partial<AcademySettings>>().notNull().default({}),
  ...timestamps(),
});

export const academicYears = pgTable(
  "academic_years",
  {
    id: id(),
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    name: text("name").notNull(), // "2026–27"
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    /** ISO weekdays 1 (Mon) … 7 (Sun). Default Mon–Sat. */
    workingDays: smallint("working_days").array().notNull().default(sql`'{1,2,3,4,5,6}'::smallint[]`),
    ...timestamps(),
  },
  (t) => [
    // Exactly one current year per academy (BR-ORG-01)
    uniqueIndex("academic_years_current_uq").on(t.academyId).where(sql`${t.isCurrent}`),
    uniqueIndex("academic_years_name_uq").on(t.academyId, t.name),
    check("academic_years_dates_ck", sql`${t.endDate} > ${t.startDate}`),
  ],
);

export const holidays = pgTable(
  "holidays",
  {
    id: id(),
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    ...timestamps(),
  },
  (t) => [
    index("holidays_year_idx").on(t.academicYearId, t.startDate),
    check("holidays_dates_ck", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export const classes = pgTable(
  "classes",
  {
    id: id(),
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id),
    name: text("name").notNull(),
    level: integer("level").notNull().default(0),
    shift: text("shift"), // Morning / Evening / free text
    capacity: integer("capacity"),
    classTeacherId: uuid("class_teacher_id").references(() => users.id),
    archivedAt: ts("archived_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("classes_year_name_uq").on(t.academicYearId, t.name).where(sql`${t.archivedAt} is null`),
    index("classes_teacher_idx").on(t.classTeacherId),
  ],
);

export const subjects = pgTable(
  "subjects",
  {
    id: id(),
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    name: text("name").notNull(),
    code: text("code"),
    archivedAt: ts("archived_at"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("subjects_name_uq").on(t.academyId, sql`lower(${t.name})`)],
);

export const classSubjects = pgTable(
  "class_subjects",
  {
    id: id(),
    classId: uuid("class_id").notNull().references(() => classes.id),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id),
    archivedAt: ts("archived_at"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("class_subjects_uq").on(t.classId, t.subjectId)],
);

export const classSubjectTeachers = pgTable(
  "class_subject_teachers",
  {
    id: id(),
    classSubjectId: uuid("class_subject_id").notNull().references(() => classSubjects.id),
    teacherId: uuid("teacher_id").notNull().references(() => users.id),
    fromDate: date("from_date").notNull(),
    toDate: date("to_date"),
    ...timestamps(),
  },
  (t) => [
    // At most one open assignment per class-subject (FR-ORG-06)
    uniqueIndex("cst_open_uq").on(t.classSubjectId).where(sql`${t.toDate} is null`),
    index("cst_teacher_open_idx").on(t.teacherId).where(sql`${t.toDate} is null`),
  ],
);

/** Gap-tolerant per-year counters for registration numbers (BR-STU-01). */
export const registrationCounters = pgTable(
  "registration_counters",
  {
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    year: smallint("year").notNull(),
    lastValue: integer("last_value").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.academyId, t.year] })],
);
