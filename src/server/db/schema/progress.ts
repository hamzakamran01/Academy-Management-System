import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  id,
  lessonTopicStatusEnum,
  noLessonReasonEnum,
  planStatusEnum,
  timestamps,
  topicStatusEnum,
  ts,
} from "./_shared";
import { users } from "./auth";
import { classSubjects } from "./org";

// ─── Syllabus: book → chapter → topic ───────────────────────────────────────
export const books = pgTable(
  "books",
  {
    id: id(),
    classSubjectId: uuid("class_subject_id").notNull().references(() => classSubjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    order: integer("order").notNull().default(0),
    archivedAt: ts("archived_at"),
    ...timestamps(),
  },
  (t) => [index("books_cs_idx").on(t.classSubjectId, t.order)],
);

export const chapters = pgTable(
  "chapters",
  {
    id: id(),
    bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    order: integer("order").notNull().default(0),
    targetDate: date("target_date"),
    archivedAt: ts("archived_at"),
    ...timestamps(),
  },
  (t) => [index("chapters_book_idx").on(t.bookId, t.order)],
);

export const topics = pgTable(
  "topics",
  {
    id: id(),
    chapterId: uuid("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    order: integer("order").notNull().default(0),
    size: smallint("size").notNull().default(1),
    /** Topic this one was copied from — lets plans be copied across classes (BR-TPR-10). */
    sourceTopicId: uuid("source_topic_id"),
    archivedAt: ts("archived_at"),
    ...timestamps(),
  },
  (t) => [
    index("topics_chapter_idx").on(t.chapterId, t.order),
    check("topics_size_ck", sql`${t.size} between 1 and 20`),
  ],
);

// ─── Weekly plan ────────────────────────────────────────────────────────────
export const weeklyPlans = pgTable(
  "weekly_plans",
  {
    id: id(),
    classSubjectId: uuid("class_subject_id").notNull().references(() => classSubjects.id),
    teacherId: uuid("teacher_id").notNull().references(() => users.id),
    weekStart: date("week_start").notNull(), // Monday
    note: text("note"),
    status: planStatusEnum("status").notNull().default("draft"),
    submittedAt: ts("submitted_at"),
    isLate: boolean("is_late").notNull().default(false),
    ...timestamps(),
  },
  (t) => [uniqueIndex("weekly_plans_uq").on(t.classSubjectId, t.weekStart), index("weekly_plans_teacher_idx").on(t.teacherId, t.weekStart)],
);

export const weeklyPlanTopics = pgTable(
  "weekly_plan_topics",
  {
    id: id(),
    weeklyPlanId: uuid("weekly_plan_id").notNull().references(() => weeklyPlans.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").notNull().references(() => topics.id),
    ...timestamps(),
  },
  (t) => [uniqueIndex("weekly_plan_topics_uq").on(t.weeklyPlanId, t.topicId)],
);

export const planComments = pgTable(
  "plan_comments",
  {
    id: id(),
    weeklyPlanId: uuid("weekly_plan_id").notNull().references(() => weeklyPlans.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id),
    text: text("text").notNull(),
    ...timestamps(),
  },
  (t) => [index("plan_comments_plan_idx").on(t.weeklyPlanId)],
);

// ─── Lesson log ─────────────────────────────────────────────────────────────
export const lessonLogs = pgTable(
  "lesson_logs",
  {
    id: id(),
    classSubjectId: uuid("class_subject_id").notNull().references(() => classSubjects.id),
    teacherId: uuid("teacher_id").notNull().references(() => users.id),
    date: date("date").notNull(),
    noLessonReason: noLessonReasonEnum("no_lesson_reason"),
    note: text("note"),
    clientId: uuid("client_id"),
    version: integer("version").notNull().default(1),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("lesson_logs_uq").on(t.classSubjectId, t.date),
    uniqueIndex("lesson_logs_client_uq").on(t.clientId),
    index("lesson_logs_teacher_idx").on(t.teacherId, t.date),
  ],
);

export const lessonLogTopics = pgTable(
  "lesson_log_topics",
  {
    id: id(),
    lessonLogId: uuid("lesson_log_id").notNull().references(() => lessonLogs.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").notNull().references(() => topics.id),
    status: lessonTopicStatusEnum("status").notNull(),
    pages: text("pages"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("lesson_log_topics_uq").on(t.lessonLogId, t.topicId), index("lesson_log_topics_topic_idx").on(t.topicId)],
);

/** Derived per (class_subject, topic) status, recomputed in the lesson-log transaction (BR-TPR-01). */
export const topicProgress = pgTable(
  "topic_progress",
  {
    id: id(),
    classSubjectId: uuid("class_subject_id").notNull().references(() => classSubjects.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
    status: topicStatusEnum("status").notNull().default("not_started"),
    completedOn: date("completed_on"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("topic_progress_uq").on(t.classSubjectId, t.topicId), index("topic_progress_cs_idx").on(t.classSubjectId)],
);

export const homework = pgTable(
  "homework",
  {
    id: id(),
    classSubjectId: uuid("class_subject_id").notNull().references(() => classSubjects.id),
    lessonLogId: uuid("lesson_log_id").references(() => lessonLogs.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    details: text("details"),
    dueDate: date("due_date").notNull(),
    attachmentKeys: text("attachment_keys").array().notNull().default(sql`'{}'::text[]`),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    ...timestamps(),
  },
  (t) => [index("homework_cs_idx").on(t.classSubjectId, t.dueDate)],
);
