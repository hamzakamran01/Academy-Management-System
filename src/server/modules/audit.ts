import "server-only";
import { headers } from "next/headers";
import type { Tx } from "@/server/db";
import { activityLog, type Sensitivity } from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";

export type ActivityInput = {
  action: string; // e.g. "fee_row.mark_paid"
  entityType: string;
  entityId?: string | null;
  summary: string; // human sentence for the log screen
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  sensitivity?: Sensitivity;
};

/**
 * Append an activity-log entry. Call inside the same transaction as the change
 * (BR-ADM-01) so the log can never disagree with the data.
 */
export async function logActivity(tx: Tx, ctx: Pick<Ctx, "academyId" | "userId" | "role"> | null, input: ActivityInput & { academyId?: string }) {
  let ip: string | null = null;
  let ua: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    ua = h.get("user-agent");
  } catch {
    // outside a request (jobs)
  }
  await tx.insert(activityLog).values({
    academyId: ctx?.academyId ?? input.academyId!,
    actorId: ctx?.userId ?? null,
    actorRole: ctx?.role ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    summary: input.summary,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
    ip,
    userAgent: ua,
    sensitivity: input.sensitivity ?? "normal",
  });
}
