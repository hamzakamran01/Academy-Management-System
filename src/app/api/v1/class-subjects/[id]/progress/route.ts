import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { classSubjectProgress } from "@/server/modules/progress";

export const GET = route<{ id: string }>(async (_req, { id }) => classSubjectProgress(await apiCtx(), id));
