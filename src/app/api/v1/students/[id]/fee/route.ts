import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { setStudentFee } from "@/server/modules/fees";
import { zOptText, zRupees } from "@/lib/validation";

const schema = z.object({ monthlyFee: zRupees, note: zOptText(120), alsoThisMonth: z.boolean().default(false) });

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const b = await parseBody(req, schema);
  return setStudentFee(await apiCtx(), id, b.monthlyFee, b.note, b.alsoThisMonth);
});
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const b = await parseBody(req, z.object({ alsoThisMonth: z.boolean().default(false) }));
  return setStudentFee(await apiCtx(), id, null, null, b.alsoThisMonth);
});
