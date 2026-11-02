import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { updateAccount } from "@/server/modules/users";
import { zName, zRole } from "@/lib/validation";

const schema = z.object({ role: zRole, name: zName.optional(), phone: z.string().optional() });

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const body = await parseBody(req, schema);
  await updateAccount(await apiCtx(), id, body.role, body);
});
