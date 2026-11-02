import { z } from "zod";
import { clientIp, parseBody, route } from "@/server/http";
import { completeSetup, rateLimitLogin } from "@/server/modules/auth";

const schema = z.object({ token: z.string().min(20).max(100), password: z.string() });

export const POST = route(async (req) => {
  rateLimitLogin(clientIp(req));
  const body = await parseBody(req, schema);
  return completeSetup(body.token, body.password);
});
