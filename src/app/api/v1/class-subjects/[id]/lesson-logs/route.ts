import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, parseQuery, route } from "@/server/http";
import { zDate, zId } from "@/lib/validation";
import { getDailyLog, saveDailyLog } from "@/server/modules/teaching";
import { todayPkt } from "@/lib/dates";

const schema = z.object({
  date: zDate,
  taught: z.string().trim().max(2000).nullable().optional(),
  homework: z.string().trim().max(1000).nullable().optional(),
  noClassReason: z.enum(["test", "revision", "teacher_absent", "event", "other"]).nullable().optional(),
  clientId: zId.nullable().optional(),
});

export const GET = route<{ id: string }>(async (req, { id }) => {
  const { date } = parseQuery(req, z.object({ date: zDate.optional() }));
  return getDailyLog(await apiCtx(), id, date ?? todayPkt());
});

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const body = await parseBody(req, schema);
  return saveDailyLog(await apiCtx(), id, { ...body, clientId: body.clientId ?? req.headers.get("idempotency-key") });
});
