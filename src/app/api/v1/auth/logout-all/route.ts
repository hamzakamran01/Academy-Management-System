import { apiCtx, destroySession, revokeAllSessions } from "@/server/auth/session";
import { route } from "@/server/http";

export const POST = route(async () => {
  const ctx = await apiCtx();
  await revokeAllSessions(ctx.userId);
  await destroySession();
  return { ok: true };
});
