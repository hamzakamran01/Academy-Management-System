import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseQuery, route } from "@/server/http";
import { zMonth } from "@/lib/validation";
import { salariesOverview } from "@/server/modules/salaries";
import { monthStart, todayPkt } from "@/lib/dates";

export const GET = route(async (req) => {
  const { month } = parseQuery(req, z.object({ month: zMonth.optional() }));
  return salariesOverview(await apiCtx(), month ?? monthStart(todayPkt()));
});
