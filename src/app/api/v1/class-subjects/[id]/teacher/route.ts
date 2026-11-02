import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { assignTeacher } from "@/server/modules/org";
import { zId } from "@/lib/validation";

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const { teacherId } = await parseBody(req, z.object({ teacherId: zId.nullable() }));
  await assignTeacher(await apiCtx(), id, teacherId);
});
