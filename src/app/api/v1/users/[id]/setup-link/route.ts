import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { newSetupLink } from "@/server/modules/users";
import { zRole } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { role } = await parseBody(req, z.object({ role: zRole }));
  return { setupLink: await newSetupLink(await apiCtx(), id, role) };
});
