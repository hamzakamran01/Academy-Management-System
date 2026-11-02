import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { getClassDetail, updateClass } from "@/server/modules/org";
import { classSchema } from "@/lib/schemas";

export const GET = route<{ id: string }>(async (_req, { id }) => getClassDetail(await apiCtx(), id));
export const PATCH = route<{ id: string }>(async (req, { id }) =>
  updateClass(await apiCtx(), id, await parseBody(req, classSchema.omit({ subjectIds: true }).partial())),
);
