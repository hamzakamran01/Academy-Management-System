import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { audienceTypeEnum, id, roleEnum, sensitivityEnum, timestamps, ts } from "./_shared";
import { users } from "./auth";
import { academy } from "./org";

export const announcements = pgTable(
  "announcements",
  {
    id: id(),
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    attachmentKeys: text("attachment_keys").array().notNull().default(sql`'{}'::text[]`),
    audienceType: audienceTypeEnum("audience_type").notNull(),
    classIds: uuid("class_ids").array().notNull().default(sql`'{}'::uuid[]`),
    pinned: boolean("pinned").notNull().default(false),
    authorId: uuid("author_id").notNull().references(() => users.id),
    publishedAt: ts("published_at").notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [index("announcements_published_idx").on(t.academyId, t.publishedAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    /** Category key, e.g. attendance.absent, result.published, fee.paid (used for mute prefs). */
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** Generic, lock-screen-safe text for push (BR-NOT-02) — never marks or money. */
    pushText: text("push_text"),
    link: text("link"),
    urgent: boolean("urgent").notNull().default(false),
    readAt: ts("read_at"),
    pushSentAt: ts("push_sent_at"),
    pushAttempts: integer("push_attempts").notNull().default(0),
    pushNextAt: ts("push_next_at"),
    pushCancelledAt: ts("push_cancelled_at"),
    ...timestamps(),
  },
  (t) => [
    index("notifications_user_read_idx").on(t.userId, t.readAt),
    index("notifications_push_queue_idx").on(t.pushNextAt).where(sql`${t.pushSentAt} is null and ${t.pushCancelledAt} is null`),
  ],
);

/** Append-only. The app DB role gets INSERT/SELECT only on this table (see database/migrations). */
export const activityLog = pgTable(
  "activity_log",
  {
    id: id(),
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    actorId: uuid("actor_id").references(() => users.id),
    actorRole: roleEnum("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    summary: text("summary"),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    sensitivity: sensitivityEnum("sensitivity").notNull().default("normal"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [
    index("activity_entity_idx").on(t.entityType, t.entityId),
    index("activity_at_idx").on(t.academyId, t.at),
    index("activity_actor_idx").on(t.actorId, t.at),
  ],
);

/** Records each scheduled job run — guarantees idempotency and feeds the "System health" card. */
export const jobRuns = pgTable(
  "job_runs",
  {
    id: id(),
    job: text("job").notNull(),
    /** Run key, e.g. "2026-11" for monthly-rows or "2026-11-02" for daily jobs. */
    runKey: text("run_key").notNull(),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    ok: boolean("ok"),
    result: jsonb("result"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("job_runs_uq").on(t.job, t.runKey)],
);
