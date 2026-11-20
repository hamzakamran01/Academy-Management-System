import { z } from "zod";
import { zId, zRupees } from "@/lib/validation";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { setClassPaperRate } from "@/server/modules/fees";

const schema = z.object({ paperFee: zRupees, alsoThisMonth: z.boolean().default(false) });

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const ctx = await apiCtx();
  const { paperFee, alsoThisMonth } = await parseBody(req, schema);
  return setClassPaperRate(ctx, zId.parse(id), paperFee, alsoThisMonth);
});
