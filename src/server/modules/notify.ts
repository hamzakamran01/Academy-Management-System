import "server-only";
import { and, eq, gt, inArray, isNull, like } from "drizzle-orm";
import type { Tx } from "@/server/db";
import { notifications, parentLinks, roleAssignments } from "@/server/db/schema";
import type { Role } from "@/lib/roles";

export type NewNotification = {
  userId: string;
  role: Role;
  /** Category key used for mute preferences, e.g. "fee.paid", "result.published". */
  type: string;
  title: string;
  /** Full in-app text (may include marks; never shown on the lock screen). */
  body: string;
  /** Lock-screen-safe push text — no marks, money or salary (BR-NOT-02). */
  pushText?: string;
  link?: string;
  urgent?: boolean;
};

/**
 * Store notifications in the same transaction as the change that caused them.
 * The push-sender job delivers them via Web Push (BR-NOT-01).
 */
export async function queueNotifications(tx: Tx, items: NewNotification[]): Promise<void> {
  if (!items.length) return;
  const now = new Date();
  await tx.insert(notifications).values(
    items.map((n) => ({
      userId: n.userId,
      role: n.role,
      type: n.type,
      title: n.title,
      body: n.body,
      pushText: n.pushText ?? n.title,
      link: n.link ?? null,
      urgent: n.urgent ?? false,
      pushNextAt: now,
    })),
  );
}

/** Active parent accounts linked to the given students → { studentId → parentUserIds }. */
export async function parentsOf(tx: Tx, studentIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!studentIds.length) return map;
  const rows = await tx
    .select({ studentId: parentLinks.studentId, userId: parentLinks.parentUserId })
    .from(parentLinks)
    .innerJoin(roleAssignments, and(eq(roleAssignments.userId, parentLinks.parentUserId), eq(roleAssignments.role, "parent"), eq(roleAssignments.active, true)))
    .where(inArray(parentLinks.studentId, studentIds));
  for (const r of rows) map.set(r.studentId, [...(map.get(r.studentId) ?? []), r.userId]);
  return map;
}

/**
 * Withdraw recent notifications for an action that was undone (BR-FEE-06):
 * unsent pushes are cancelled and the in-app item removed.
 */
export async function withdrawRecent(tx: Tx, type: string, linkPrefix: string, withinMs = 5 * 60_000): Promise<void> {
  await tx
    .delete(notifications)
    .where(and(eq(notifications.type, type), like(notifications.link, `${linkPrefix}%`), gt(notifications.createdAt, new Date(Date.now() - withinMs)), isNull(notifications.readAt)));
}
