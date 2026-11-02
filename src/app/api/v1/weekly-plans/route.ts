import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, parseQuery, route } from "@/server/http";
import { zDate, zId } from "@/lib/validation";
import { getWeeklyPlan, saveWeeklyPlan } from "@/server/modules/progress";
import { todayPkt } from "@/lib/dates";

const query = z.object({ classSubjectId: zId, week: zDate.optional() });
const body = z.object({ classSubjectId: zId, week: zDate, topicIds: z.array(zId).max(100), note: z.string().trim().max(500).nullable().optional(), submit: z.boolean().optional() });

export const GET = route(async (req) => {
  const q = parseQuery(req, query);
  return getWeeklyPlan(await apiCtx(), q.classSubjectId, q.week ?? todayPkt());
});
export const PUT = route(async (req) => {
  const b = await parseBody(req, body);
  return saveWeeklyPlan(await apiCtx(), b.classSubjectId, b.week, b);
});
