import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { roleAssignments, setupTokens, users } from "@/server/db/schema";
import { ROLE_PRIORITY, type Role } from "@/lib/roles";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { ApiError, badRequest } from "@/server/http";
import { burnPasswordCheck, hashPassword, hashToken, newToken, passwordProblem, verifyPassword } from "@/server/auth/crypto";
import { createSession } from "@/server/auth/session";

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
const SETUP_DAYS = 7;

// Best-effort per-IP limiter (NFR-SEC-02: 10 req/min/IP). Per-instance memory is
// fine for a single app server; the per-account lockout below is the hard guard.
const ipHits = new Map<string, { n: number; reset: number }>();
export function rateLimitLogin(ip: string) {
  const now = Date.now();
  const hit = ipHits.get(ip);
  if (!hit || hit.reset < now) {
    ipHits.set(ip, { n: 1, reset: now + 60_000 });
    if (ipHits.size > 10_000) ipHits.clear();
    return;
  }
  if (++hit.n > 10) throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Wait a minute and try again.");
}

const GENERIC = "Incorrect phone or password";

export async function login(phoneInput: string, password: string): Promise<{ role: Role }> {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw badRequest("INVALID_PHONE", PHONE_ERROR);

  const [user] = await db.select().from(users).where(eq(users.phone, phone));
  if (!user || !user.passwordHash || user.status !== "active") {
    await burnPasswordCheck(password);
    throw new ApiError(401, "BAD_CREDENTIALS", user && !user.passwordHash ? "Finish setting up your account using the link you received" : GENERIC);
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new ApiError(423, "LOCKED", `Too many wrong attempts. Try again in ${mins} min.`);
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await db
      .update(users)
      .set({
        failedLogins: failed >= LOCK_AFTER ? 0 : failed,
        lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      })
      .where(eq(users.id, user.id));
    throw new ApiError(401, "BAD_CREDENTIALS", GENERIC);
  }

  const role = await defaultRole(user.id);
  if (!role) throw new ApiError(403, "NO_ROLE", "Your account has no active access. Contact the academy office.");
  await db.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id, role);
  return { role };
}

async function defaultRole(userId: string): Promise<Role | null> {
  const rows = await db
    .select({ role: roleAssignments.role })
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, userId), eq(roleAssignments.active, true)));
  return ROLE_PRIORITY.find((r) => rows.some((x) => x.role === r)) ?? null;
}

/** Look up an unused, unexpired setup token. */
export async function findSetupToken(raw: string) {
  const [row] = await db
    .select({ id: setupTokens.id, userId: setupTokens.userId, expiresAt: setupTokens.expiresAt, usedAt: setupTokens.usedAt, name: users.name, phone: users.phone, hasPassword: users.passwordHash })
    .from(setupTokens)
    .innerJoin(users, eq(users.id, setupTokens.userId))
    .where(eq(setupTokens.tokenHash, hashToken(raw)));
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return { id: row.id, userId: row.userId, name: row.name, phone: row.phone, isReset: !!row.hasPassword, strong: await isOwner(row.userId) };
}

/** Owners see all money and salaries, so their passwords must be a little stronger. */
export async function isOwner(userId: string): Promise<boolean> {
  const [r] = await db
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, userId), eq(roleAssignments.role, "super_admin"), eq(roleAssignments.active, true)));
  return !!r;
}

export async function completeSetup(raw: string, password: string): Promise<{ role: Role }> {
  const token = await findSetupToken(raw);
  if (!token) throw new ApiError(410, "LINK_EXPIRED", "This link has expired or was already used. Ask the academy office for a new one.");
  const problem = passwordProblem(password, { strong: token.strong, phone: token.phone });
  if (problem) throw badRequest("WEAK_PASSWORD", problem);

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(setupTokens).set({ usedAt: new Date() }).where(eq(setupTokens.id, token.id));
    await tx.update(users).set({ passwordHash, failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, token.userId));
  });
  const role = await defaultRole(token.userId);
  if (!role) throw new ApiError(403, "NO_ROLE", "Your account has no active access. Contact the academy office.");
  await createSession(token.userId, role);
  return { role };
}

/**
 * Issue a new setup link for a user (BR-AUTH-03). Earlier unused tokens are
 * invalidated. Returns the raw token — only ever shown once to the creator.
 */
export async function issueSetupToken(tx: Tx, userId: string, createdBy: string | null): Promise<string> {
  await tx
    .update(setupTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(setupTokens.userId, userId), isNull(setupTokens.usedAt)));
  const raw = newToken();
  await tx.insert(setupTokens).values({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + SETUP_DAYS * 86_400_000),
    createdBy,
  });
  return raw;
}

export function setupUrl(raw: string): string {
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return `${base}/setup/${raw}`;
}

export async function changePassword(userId: string, current: string, next: string) {
  const [u] = await db.select({ hash: users.passwordHash, phone: users.phone }).from(users).where(eq(users.id, userId));
  const problem = passwordProblem(next, { strong: await isOwner(userId), phone: u?.phone });
  if (problem) throw badRequest("WEAK_PASSWORD", problem, { fields: { next: problem } });
  if (!u?.hash || !(await verifyPassword(u.hash, current))) throw badRequest("BAD_PASSWORD", "Current password is incorrect");
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
}
