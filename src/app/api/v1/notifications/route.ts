import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { listNotifications } from "@/server/modules/notifications";

export const GET = route(async () => listNotifications(await apiCtx()));
