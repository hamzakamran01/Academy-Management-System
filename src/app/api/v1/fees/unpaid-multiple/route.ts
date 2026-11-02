import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { unpaidMultiple } from "@/server/modules/fees";

export const GET = route(async () => unpaidMultiple(await apiCtx()));
