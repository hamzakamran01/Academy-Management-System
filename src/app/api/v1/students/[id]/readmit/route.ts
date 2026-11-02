import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { readmitStudent } from "@/server/modules/students";
import { moveSchema } from "@/lib/schemas";

export const POST = route<{ id: string }>(async (req, { id }) => readmitStudent(await apiCtx(), id, await parseBody(req, moveSchema)));
