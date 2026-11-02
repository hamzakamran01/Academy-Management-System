import { sql } from "drizzle-orm";
import { pgEnum, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Column helpers shared by every table.
 *
 * Tenancy (SRS C6): aggregate-root tables carry `academy_id`. Child rows
 * (marks, attendance_marks, plan/log topics, …) inherit tenancy through their
 * parent's foreign key, so they don't repeat it.
 */
export const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const ts = (name: string) => timestamp(name, { withTimezone: true });

// ─── Enums ──────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["super_admin", "admin", "teacher", "parent"]);
export const userStatusEnum = pgEnum("user_status", ["active", "deactivated"]);
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const studentStatusEnum = pgEnum("student_status", ["active", "removed"]);
export const removalReasonEnum = pgEnum("removal_reason", [
  "left",
  "completed",
  "transferred",
  "expelled",
  "other",
]);
export const relationEnum = pgEnum("parent_relation", ["father", "mother", "guardian"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "late", "leave"]);
export const assessmentTypeEnum = pgEnum("assessment_type", ["weekly", "monthly", "midterm", "final", "other"]);
export const assessmentStatusEnum = pgEnum("assessment_status", ["draft", "published", "unlocked"]);
export const topicStatusEnum = pgEnum("topic_status", ["not_started", "started", "completed"]);
export const lessonTopicStatusEnum = pgEnum("lesson_topic_status", ["started", "completed"]);
export const noLessonReasonEnum = pgEnum("no_lesson_reason", [
  "test",
  "revision",
  "teacher_absent",
  "event",
  "other",
]);
export const planStatusEnum = pgEnum("plan_status", ["draft", "submitted"]);
export const feeStatusEnum = pgEnum("fee_status", ["unpaid", "paid", "waived"]);
export const salaryStatusEnum = pgEnum("salary_status", ["pending", "paid"]);
export const audienceTypeEnum = pgEnum("audience_type", ["all", "parents", "teachers", "classes"]);
export const sensitivityEnum = pgEnum("sensitivity", ["normal", "finance_amount", "salary"]);

export type Role = (typeof roleEnum.enumValues)[number];
export type AttendanceStatus = (typeof attendanceStatusEnum.enumValues)[number];
export type FeeStatus = (typeof feeStatusEnum.enumValues)[number];
export type AssessmentType = (typeof assessmentTypeEnum.enumValues)[number];
export type AssessmentStatus = (typeof assessmentStatusEnum.enumValues)[number];
export type TopicStatus = (typeof topicStatusEnum.enumValues)[number];
export type NoLessonReason = (typeof noLessonReasonEnum.enumValues)[number];
export type RemovalReason = (typeof removalReasonEnum.enumValues)[number];
export type Sensitivity = (typeof sensitivityEnum.enumValues)[number];
