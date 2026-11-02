import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { changePassword } from "@/server/modules/auth";

const schema = z.object({ current: z.string().min(1, "Enter your current password"), next: z.string() });

export const POST = route(async (req) => {
  const ctx = await apiCtx();
  const body = await parseBody(req, schema);
  await changePassword(ctx.userId, body.current, body.next);
  return { ok: true };
});
