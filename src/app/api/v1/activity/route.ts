import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseQuery, route } from "@/server/http";
import { listActivity } from "@/server/modules/admin";

const query = z.object({
  q: z.string().max(80).optional(),
  entityType: z.string().max(40).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/** No update/delete endpoints exist for the activity log (BR-ADM-03). */
export const GET = route(async (req) => listActivity(await apiCtx(), parseQuery(req, query)));
