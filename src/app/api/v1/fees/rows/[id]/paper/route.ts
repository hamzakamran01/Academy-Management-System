import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { markPaperFee } from "@/server/modules/fees";

const schema = z.object({ paid: z.boolean() });

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const { paid } = await parseBody(req, schema);
  await markPaperFee(await apiCtx(), id, paid);
});
