import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { zMonth, zRupees } from "@/lib/validation";
import { setSalary } from "@/server/modules/salaries";

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const b = await parseBody(req, z.object({ monthlySalary: zRupees, effectiveFrom: zMonth }));
  await setSalary(await apiCtx(), id, b.monthlySalary, b.effectiveFrom);
});
