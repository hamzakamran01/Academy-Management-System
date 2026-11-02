import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseQuery, route } from "@/server/http";
import { classFeeList } from "@/server/modules/fees";
import { zId, zMonth } from "@/lib/validation";

const query = z.object({ classId: zId, month: zMonth });

/** Teacher responses omit amounts (SRS 8.3 *). */
export const GET = route(async (req) => {
  const q = parseQuery(req, query);
  return classFeeList(await apiCtx(), q.classId, q.month);
});
