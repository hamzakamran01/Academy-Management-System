import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { requestCorrection } from "@/server/modules/results";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { note } = await parseBody(req, z.object({ note: z.string().trim().max(300).default("") }));
  await requestCorrection(await apiCtx(), id, note);
});
