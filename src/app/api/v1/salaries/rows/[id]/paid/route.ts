import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { zDate } from "@/lib/validation";
import { markSalary } from "@/server/modules/salaries";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const b = await parseBody(req, z.object({ paidOn: zDate.optional(), note: z.string().trim().max(200).nullable().optional() }));
  await markSalary(await apiCtx(), id, "paid", b.paidOn, b.note);
});
