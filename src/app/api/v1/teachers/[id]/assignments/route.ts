import { z } from "zod";
import { zId } from "@/lib/validation";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { assignTeacherFromProfile } from "@/server/modules/org";

const schema = z.object({ classId: zId, subjectId: zId, previousTeacherId: zId.nullable() });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const ctx = await apiCtx();
  await assignTeacherFromProfile(ctx, zId.parse(id), await parseBody(req, schema));
});
