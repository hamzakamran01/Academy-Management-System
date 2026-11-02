import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { addPlanComment } from "@/server/modules/progress";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { text } = await parseBody(req, z.object({ text: z.string().trim().min(1).max(500) }));
  await addPlanComment(await apiCtx(), id, text);
});
