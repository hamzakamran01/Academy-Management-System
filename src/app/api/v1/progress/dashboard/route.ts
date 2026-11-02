import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseQuery, route } from "@/server/http";
import { zId } from "@/lib/validation";
import { progressDashboard } from "@/server/modules/progress";

export const GET = route(async (req) => progressDashboard(await apiCtx(), parseQuery(req, z.object({ classId: zId.optional(), teacherId: zId.optional() }))));
