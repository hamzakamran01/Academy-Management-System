import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { removeStudent } from "@/server/modules/students";
import { removeSchema } from "@/lib/schemas";

export const POST = route<{ id: string }>(async (req, { id }) => removeStudent(await apiCtx(), id, await parseBody(req, removeSchema)));
