import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { deleteStudent, getStudentProfile, updateStudent } from "@/server/modules/students";
import { studentUpdateSchema } from "@/lib/schemas";

export const GET = route<{ id: string }>(async (_req, { id }) => getStudentProfile(await apiCtx(), id));
export const PATCH = route<{ id: string }>(async (req, { id }) => updateStudent(await apiCtx(), id, await parseBody(req, studentUpdateSchema)));
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const { confirmName } = await parseBody(req, z.object({ confirmName: z.string() }));
  await deleteStudent(await apiCtx(), id, confirmName);
});
