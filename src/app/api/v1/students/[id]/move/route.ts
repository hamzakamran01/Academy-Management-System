import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { moveStudent } from "@/server/modules/students";
import { moveSchema } from "@/lib/schemas";

export const POST = route<{ id: string }>(async (req, { id }) => moveStudent(await apiCtx(), id, await parseBody(req, moveSchema)));
