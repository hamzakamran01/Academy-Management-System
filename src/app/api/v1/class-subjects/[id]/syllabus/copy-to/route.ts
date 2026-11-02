import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { zId } from "@/lib/validation";
import { copySyllabus } from "@/server/modules/progress";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { targets } = await parseBody(req, z.object({ targets: z.array(zId).min(1).max(30) }));
  await copySyllabus(await apiCtx(), id, targets);
});
