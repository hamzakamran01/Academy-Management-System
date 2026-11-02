import "server-only";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/server/db";
import { notifications, pushSubscriptions, users } from "@/server/db/schema";
import { categoryOf } from "./notifications";

const BACKOFF_MIN = [1, 5, 15]; // BR-NOT-01: 3 attempts
let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub!, priv!);
  return configured;
}

export const pushConfigured = () => configure();

/**
 * Deliver queued notifications via Web Push (BR-NOT-01/02/03).
 * Push payloads contain only the lock-screen-safe text and a link.
 * Safe to run concurrently-ish: each row is claimed by bumping push_attempts.
 */
export async function sendPendingPushes(limit = 200): Promise<{ sent: number; skipped: number; failed: number }> {
  if (!configure()) return { sent: 0, skipped: 0, failed: 0 };
  const now = new Date();
  const due = await db
    .select({ n: notifications, prefs: users.notificationPrefs })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(and(isNull(notifications.pushSentAt), isNull(notifications.pushCancelledAt), lte(notifications.pushNextAt, now), sql`${notifications.pushAttempts} < 3`))
    .orderBy(asc(notifications.createdAt))
    .limit(limit);
  let sent = 0, skipped = 0, failed = 0;
  for (const { n, prefs } of due) {
    // Muted category, or parent daily summary holds non-urgent items (sent at 19:00 by the summary job)
    if (prefs?.mutedPush?.includes(categoryOf(n.type)) || (prefs?.dailySummary && !n.urgent && n.role === "parent")) {
      await db.update(notifications).set({ pushCancelledAt: now }).where(eq(notifications.id, n.id));
      skipped++;
      continue;
    }
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, n.userId));
    if (!subs.length) {
      await db.update(notifications).set({ pushCancelledAt: now }).where(eq(notifications.id, n.id));
      skipped++;
      continue;
    }
    const payload = JSON.stringify({ title: "Campusly", body: n.pushText ?? n.title, url: n.link ?? "/notifications", tag: n.type });
    let ok = false;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86_400, urgency: n.urgent ? "high" : "normal" });
        ok = true;
        await db.update(pushSubscriptions).set({ lastSuccessAt: now, failedCount: 0 }).where(eq(pushSubscriptions.id, s.id));
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        else await db.update(pushSubscriptions).set({ failedCount: sql`${pushSubscriptions.failedCount} + 1` }).where(eq(pushSubscriptions.id, s.id));
      }
    }
    if (ok) {
      await db.update(notifications).set({ pushSentAt: now, pushAttempts: sql`${notifications.pushAttempts} + 1` }).where(eq(notifications.id, n.id));
      sent++;
    } else {
      const attempt = n.pushAttempts + 1;
      await db
        .update(notifications)
        .set({ pushAttempts: attempt, pushNextAt: new Date(now.getTime() + (BACKOFF_MIN[attempt - 1] ?? 15) * 60_000) })
        .where(eq(notifications.id, n.id));
      failed++;
    }
  }
  return { sent, skipped, failed };
}

/** BR-NOT-03: one summary push per opted-in parent at 19:00 for today's held items. */
export async function sendDailySummaries(): Promise<number> {
  if (!configure()) return 0;
  const since = new Date(Date.now() - 24 * 3600_000);
  const held = await db
    .select({ userId: notifications.userId, n: sql<number>`count(*)::int` })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(
      and(
        eq(notifications.role, "parent"),
        sql`${notifications.pushCancelledAt} >= ${since}`,
        isNull(notifications.pushSentAt),
        sql`(${users.notificationPrefs} ->> 'dailySummary')::boolean is true`,
      ),
    )
    .groupBy(notifications.userId);
  let count = 0;
  for (const h of held) {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, h.userId));
    const payload = JSON.stringify({ title: "Campusly · today", body: `${h.n} update${h.n === 1 ? "" : "s"} about your child — tap to view`, url: "/notifications", tag: "daily-summary" });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 43_200 });
        count++;
      } catch {
        /* next run */
      }
    }
  }
  return count;
}
