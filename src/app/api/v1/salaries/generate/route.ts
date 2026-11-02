import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { zMonth } from "@/lib/validation";
import { forbidden } from "@/server/http";
import { generateSalaryRows } from "@/server/modules/salaries";

export const POST = route(async (req) => {
  const ctx = await apiCtx();
  if (ctx.role !== "super_admin") throw forbidden();
  const { month } = await parseBody(req, z.object({ month: zMonth }));
  return generateSalaryRows(ctx.academyId, month, ctx);
});
