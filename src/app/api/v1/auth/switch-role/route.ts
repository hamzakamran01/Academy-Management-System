import { z } from "zod";
import { apiCtx, createSession, destroySession } from "@/server/auth/session";
import { forbidden, parseBody, route } from "@/server/http";

const schema = z.object({ role: z.enum(["super_admin", "admin", "teacher", "parent"]) });

/** BR-AUTH-09: switching role starts a new session context without a password. */
export const POST = route(async (req) => {
  const ctx = await apiCtx();
  const { role } = await parseBody(req, schema);
  if (!ctx.roles.includes(role)) throw forbidden("You don't hold that role");
  await destroySession();
  await createSession(ctx.userId, role);
  return { role };
});
