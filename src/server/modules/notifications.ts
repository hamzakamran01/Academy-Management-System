import "server-only";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { notifications, pushSubscriptions, users, type NotificationPrefs } from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";

/** Categories users can mute for push (account/security is never optional — FR-NOT-03). */
export const CATEGORIES: { key: string; label: string; roles: Ctx["role"][] }[] = [
  { key: "result", label: "Results published or corrected", roles: ["parent"] },
  { key: "homework", label: "Homework", roles: ["parent"] },
  { key: "fee", label: "Fee updates & reminders", roles: ["parent"] },
  { key: "announcement", label: "Announcements", roles: ["parent", "teacher", "admin", "super_admin"] },
  { key: "plan", label: "Weekly plan comments", roles: ["teacher"] },
  { key: "reminder", label: "Reminders (lesson log, plans, tests)", roles: ["teacher", "admin"] },
  { key: "salary", label: "Salary updates", roles: ["teacher", "admin"] },
  { key: "system", label: "System & job alerts", roles: ["super_admin", "admin"] },
];

/** Category of a notification type, e.g. "result.published" → "result". */
export const categoryOf = (type: string) => type.split(".")[0]!;

export async function listNotifications(ctx: Ctx, limit = 60) {
  return db
    .select({ id: notifications.id, type: notifications.type, title: notifications.title, body: notifications.body, link: notifications.link, readAt: notifications.readAt, createdAt: notifications.createdAt })
    .from(notifications)
    .where(and(eq(notifications.userId, ctx.userId), eq(notifications.role, ctx.role)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(ctx: Ctx): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, ctx.userId), eq(notifications.role, ctx.role), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function markRead(ctx: Ctx, ids: string[] | "all") {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, ctx.userId),
        eq(notifications.role, ctx.role),
        isNull(notifications.readAt),
        ids === "all" ? undefined : inArray(notifications.id, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      ),
    );
}

export async function getPrefs(ctx: Ctx): Promise<NotificationPrefs> {
  const [u] = await db.select({ p: users.notificationPrefs }).from(users).where(eq(users.id, ctx.userId));
  return u?.p ?? { mutedPush: [], dailySummary: false };
}

export async function setPrefs(ctx: Ctx, prefs: NotificationPrefs) {
  const allowed = new Set(CATEGORIES.map((c) => c.key));
  await db
    .update(users)
    .set({ notificationPrefs: { mutedPush: prefs.mutedPush.filter((k) => allowed.has(k)), dailySummary: ctx.role === "parent" ? prefs.dailySummary : false } })
    .where(eq(users.id, ctx.userId));
}

export async function subscribePush(ctx: Ctx, sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string | null) {
  await db
    .insert(pushSubscriptions)
    .values({ userId: ctx.userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, userAgent })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: ctx.userId, p256dh: sub.p256dh, auth: sub.auth, userAgent, failedCount: 0 } });
}

export async function unsubscribePush(ctx: Ctx, endpoint: string) {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, ctx.userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function hasPushSubscription(ctx: Ctx) {
  const [r] = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, ctx.userId)).limit(1);
  return !!r;
}

/** Retention (SRS §4.4): notifications older than 12 months are purged. */
export async function purgeOldNotifications() {
  const cutoff = new Date(Date.now() - 365 * 86_400_000);
  const r = await db.delete(notifications).where(lt(notifications.createdAt, cutoff)).returning({ id: notifications.id });
  return r.length;
}
