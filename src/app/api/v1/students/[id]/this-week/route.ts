import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { parentProgress } from "@/server/modules/progress";

export const GET = route<{ id: string }>(async (_req, { id }) => parentProgress(await apiCtx(), id));
