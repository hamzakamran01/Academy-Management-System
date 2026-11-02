import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { roleAssignments, sessions, users } from "@/server/db/schema";
import { ROLE_PRIORITY, SESSION_DAYS, type Role } from "@/lib/roles";
import { unauthorized } from "@/server/http";
import { hashToken, newToken } from "./crypto";

export const SESSION_COOKIE = "cl_session";
const SLIDE_EVERY_MS = 5 * 60_000; // BR-AUTH-07: last_seen updated at most every 5 min

/** Everything a request needs to know about who is asking. */
export type Ctx = {
  sessionId: string;
  userId: string;
  academyId: string;
  role: Role;
  roles: Role[];
  name: string;
  phone: string;
};

function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : "Device";
  const br = /SamsungBrowser/i.test(ua) ? "Samsung Internet" : /Edg\//i.test(ua) ? "Edge" : /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : /Firefox/i.test(ua) ? "Firefox" : "Browser";
  return `${br} on ${os}`;
}

export async function createSession(userId: string, role: Role): Promise<void> {
  const token = newToken();
  const days = SESSION_DAYS[role];
  const ua = (await headers()).get("user-agent");
  await db.insert(sessions).values({
    userId,
    role,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + days * 86_400_000),
    deviceLabel: deviceLabel(ua),
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: days * 86_400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string, role?: Role): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), role ? eq(sessions.role, role) : undefined));
}

/** Resolve the current session once per request (React cache). */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: sessions.id,
      role: sessions.role,
      lastSeenAt: sessions.lastSeenAt,
      userId: users.id,
      academyId: users.academyId,
      name: users.name,
      phone: users.phone,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())));
  if (!row || row.status !== "active") return null;

  const roleRows = await db
    .select({ role: roleAssignments.role })
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, row.userId), eq(roleAssignments.active, true)));
  const roles = ROLE_PRIORITY.filter((r) => roleRows.some((x) => x.role === r));
  // BR-AUTH-08: a removed role ends that role's sessions.
  if (!roles.includes(row.role)) return null;

  if (Date.now() - row.lastSeenAt.getTime() > SLIDE_EVERY_MS) {
    const now = new Date();
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_DAYS[row.role] * 86_400_000) })
      .where(eq(sessions.id, row.sessionId));
    await db.update(users).set({ lastActiveAt: now }).where(eq(users.id, row.userId));
  }

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    academyId: row.academyId,
    role: row.role,
    roles,
    name: row.name,
    phone: row.phone,
  };
});

/** For pages: redirect to login when signed out; optionally restrict by role. */
export async function requireCtx(allowed?: Role[]): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (allowed && !allowed.includes(ctx.role)) redirect("/home?denied=1");
  return ctx;
}

/** For API routes: 401 when signed out. */
export async function apiCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) throw unauthorized();
  return ctx;
}
