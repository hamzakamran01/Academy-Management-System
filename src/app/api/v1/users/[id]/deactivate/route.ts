import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { setRoleActive } from "@/server/modules/users";
import { zRole } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { role } = await parseBody(req, z.object({ role: zRole }));
  await setRoleActive(await apiCtx(), id, role, false);
});
