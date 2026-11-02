import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { addParentToStudent, unlinkParent } from "@/server/modules/students";
import { parentSchema } from "@/lib/schemas";

export const POST = route<{ id: string }>(async (req, { id }) => addParentToStudent(await apiCtx(), id, await parseBody(req, parentSchema)));
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const { parentUserId } = await parseBody(req, z.object({ parentUserId: z.string().uuid() }));
  await unlinkParent(await apiCtx(), id, parentUserId);
});
