import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { markFee } from "@/server/modules/fees";
import { zOptText } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const b = await parseBody(req, z.object({ note: zOptText(200) }).partial());
  return markFee(await apiCtx(), id, "paid", b.note);
});
