import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseQuery, route } from "@/server/http";
import { financeSummary } from "@/server/modules/fees";
import { zMonth } from "@/lib/validation";

export const GET = route(async (req) => financeSummary(await apiCtx(), parseQuery(req, z.object({ month: zMonth })).month));
