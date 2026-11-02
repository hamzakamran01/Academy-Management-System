import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, roleEnum, timestamps, ts, userStatusEnum } from "./_shared";
import { academy } from "./org";

export type NotificationPrefs = {
  /** Category keys that the user has switched OFF for push. Account/security is never optional. */
  mutedPush: string[];
  /** Parent opt-in: hold non-urgent pushes and send one summary at 19:00 (BR-NOT-03). */
  dailySummary: boolean;
};

export const users = pgTable(
  "users",
  {
    id: id(),
    academyId: uuid("academy_id").notNull().references(() => academy.id),
    phone: text("phone").notNull(), // E.164, +923xxxxxxxxx
    name: text("name").notNull(),
    photoKey: text("photo_key"),
    passwordHash: text("password_hash"), // null until the setup link is used
    status: userStatusEnum("status").notNull().default("active"),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastLoginAt: ts("last_login_at"),
    lastActiveAt: ts("last_active_at"),
    notificationPrefs: jsonb("notification_prefs")
      .$type<NotificationPrefs>()
      .notNull()
      .default({ mutedPush: [], dailySummary: false }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("users_phone_uq").on(t.phone)],
);

export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex("role_assignments_user_role_uq").on(t.userId, t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    deviceLabel: text("device_label"),
    revokedAt: ts("revoked_at"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const setupTokens = pgTable(
  "setup_tokens",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("setup_tokens_hash_uq").on(t.tokenHash),
    index("setup_tokens_user_open_idx").on(t.userId).where(sql`${t.usedAt} is null`),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    lastSuccessAt: ts("last_success_at"),
    failedCount: integer("failed_count").notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_uq").on(t.endpoint), index("push_subscriptions_user_idx").on(t.userId)],
);
