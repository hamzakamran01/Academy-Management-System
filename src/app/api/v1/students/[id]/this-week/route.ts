import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { parentClassLog } from "@/server/modules/teaching";

export const GET = route<{ id: string }>(async (_req, { id }) => parentClassLog(await apiCtx(), id, 7));
