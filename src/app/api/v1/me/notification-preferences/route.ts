import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { getPrefs, setPrefs } from "@/server/modules/notifications";

export const GET = route(async () => getPrefs(await apiCtx()));
export const PUT = route(async (req) => setPrefs(await apiCtx(), await parseBody(req, z.object({ mutedPush: z.array(z.string().max(30)).max(20), dailySummary: z.boolean() }))));
