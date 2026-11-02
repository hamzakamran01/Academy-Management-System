import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { forbidden, parseBody, route } from "@/server/http";
import { generateMonthRows } from "@/server/modules/fees";
import { isStaffAdmin } from "@/lib/roles";
import { zMonth } from "@/lib/validation";

/** FR-FEE-04 manual trigger ("Create this month's fee list") — SA, A. */
export const POST = route(async (req) => {
  const ctx = await apiCtx();
  if (!isStaffAdmin(ctx.role)) throw forbidden();
  const { month } = await parseBody(req, z.object({ month: zMonth }));
  return generateMonthRows(ctx.academyId, month, ctx);
});
