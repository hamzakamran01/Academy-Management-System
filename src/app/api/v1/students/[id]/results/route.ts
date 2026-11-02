import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { studentResults } from "@/server/modules/results";

export const GET = route<{ id: string }>(async (_req, { id }) => studentResults(await apiCtx(), id));
