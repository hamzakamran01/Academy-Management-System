import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseQuery, route } from "@/server/http";
import { financeTrend } from "@/server/modules/fees";

export const GET = route(async (req) =>
  financeTrend(await apiCtx(), parseQuery(req, z.object({ months: z.coerce.number().int().min(1).max(24).default(12) })).months),
);
