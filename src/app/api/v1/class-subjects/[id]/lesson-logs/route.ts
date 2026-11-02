import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, parseQuery, route } from "@/server/http";
import { zDate, zId } from "@/lib/validation";
import { getLessonLog, saveLessonLog } from "@/server/modules/progress";
import { todayPkt } from "@/lib/dates";

const schema = z.object({
  date: zDate,
  topics: z.array(z.object({ topicId: zId, status: z.enum(["started", "completed"]), pages: z.string().trim().max(60).nullable().optional() })).max(60),
  noLessonReason: z.enum(["test", "revision", "teacher_absent", "event", "other"]).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  homework: z.object({ title: z.string().trim().min(2, "Enter the homework").max(160), details: z.string().trim().max(1000).nullable().optional(), dueDate: zDate }).nullable().optional(),
  clientId: zId.nullable().optional(),
});

export const GET = route<{ id: string }>(async (req, { id }) => {
  const { date } = parseQuery(req, z.object({ date: zDate.optional() }));
  return getLessonLog(await apiCtx(), id, date ?? todayPkt());
});
export const PUT = route<{ id: string }>(async (req, { id }) => {
  const body = await parseBody(req, schema);
  return saveLessonLog(await apiCtx(), id, { ...body, clientId: body.clientId ?? req.headers.get("idempotency-key") });
});
