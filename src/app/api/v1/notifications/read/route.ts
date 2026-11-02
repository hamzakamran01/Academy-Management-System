import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { zId } from "@/lib/validation";
import { markRead } from "@/server/modules/notifications";

export const POST = route(async (req) => {
  const { ids } = await parseBody(req, z.object({ ids: z.union([z.literal("all"), z.array(zId).max(200)]) }));
  await markRead(await apiCtx(), ids);
});
