import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { addClassSubject } from "@/server/modules/org";
import { zId } from "@/lib/validation";

const schema = z.object({ subjectId: zId, teacherId: zId.optional().nullable() });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const body = await parseBody(req, schema);
  await addClassSubject(await apiCtx(), id, body.subjectId, body.teacherId);
});
