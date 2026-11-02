import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { waiveFee } from "@/server/modules/fees";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { reason } = await parseBody(req, z.object({ reason: z.string().trim().min(3, "Give a short reason").max(200) }));
  await waiveFee(await apiCtx(), id, reason);
});
