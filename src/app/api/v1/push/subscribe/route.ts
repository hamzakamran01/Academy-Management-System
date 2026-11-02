import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { subscribePush, unsubscribePush } from "@/server/modules/notifications";

const sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export const POST = route(async (req) => {
  const b = await parseBody(req, sub);
  await subscribePush(await apiCtx(), { endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth }, req.headers.get("user-agent"));
});
export const DELETE = route(async (req) => {
  const { endpoint } = await parseBody(req, z.object({ endpoint: z.string().url() }));
  await unsubscribePush(await apiCtx(), endpoint);
});
