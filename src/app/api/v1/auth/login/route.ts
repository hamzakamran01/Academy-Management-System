import { z } from "zod";
import { clientIp, parseBody, route } from "@/server/http";
import { login, rateLimitLogin } from "@/server/modules/auth";

const schema = z.object({ phone: z.string().min(1, "Enter your mobile number"), password: z.string().min(1, "Enter your password") });

export const POST = route(async (req) => {
  rateLimitLogin(clientIp(req));
  const body = await parseBody(req, schema);
  return login(body.phone, body.password);
});
