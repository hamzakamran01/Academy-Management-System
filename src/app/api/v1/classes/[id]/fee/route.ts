import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { setClassFee } from "@/server/modules/fees";
import { zRupees } from "@/lib/validation";

const schema = z.object({ monthlyFee: zRupees, alsoThisMonth: z.boolean().default(false) });

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const b = await parseBody(req, schema);
  return setClassFee(await apiCtx(), id, b.monthlyFee, b.alsoThisMonth);
});
