import { renewOwnerSession } from "@/server/auth/session";
import { route } from "@/server/http";

export const POST = route(async () => {
  await renewOwnerSession();
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
});
