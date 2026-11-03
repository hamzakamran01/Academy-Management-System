import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

/** 32 random bytes, URL-safe (BR-AUTH-03, BR-AUTH-07). */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the SHA-256 of a token is ever stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Argon2id — memory ≥ 19 MiB, iterations ≥ 2 (BR-AUTH-05). algorithm 2 = Argon2id.
const ARGON = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON);
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/** A constant hash used to spend equal time when the phone doesn't exist (no user enumeration). */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("campusly-timing-equaliser");
  await verifyPassword(await dummyHash, password);
}

export { passwordProblem } from "@/lib/password";
