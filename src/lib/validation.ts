import { z } from "zod";
import { isValidISODate } from "./dates";

/** Shared Zod building blocks — same rules on phone and server. */
export const zId = z.string().uuid();
export const zDate = z.string().refine(isValidISODate, "Enter a valid date");
export const zMonth = z.string().regex(/^\d{4}-\d{2}-01$/, "Pick a month");
export const zName = z.string().trim().min(2, "Enter at least 2 characters").max(120);
export const zRole = z.enum(["super_admin", "admin", "teacher", "parent"]);
export const zRupees = z.number().int("Whole rupees only").min(0, "Cannot be negative").max(10_000_000);
export const zOptText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** For untrusted URL params on pages: returns the value only if it is a UUID. */
export const uuidOrUndefined = (v: string | undefined | null) => (v && UUID_RE.test(v) ? v : undefined);
