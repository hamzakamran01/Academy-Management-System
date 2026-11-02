import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { unlockAssessment } from "@/server/modules/results";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { reason } = await parseBody(req, z.object({ reason: z.string().trim().min(3, "Give a reason").max(300) }));
  await unlockAssessment(await apiCtx(), id, reason);
});
