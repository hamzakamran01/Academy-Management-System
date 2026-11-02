import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { publishAssessment } from "@/server/modules/results";

export const POST = route<{ id: string }>(async (_req, { id }) => publishAssessment(await apiCtx(), id));
