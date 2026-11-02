import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { ApiError, parseBody, route } from "@/server/http";
import { moveStudent } from "@/server/modules/students";
import { zDate, zId } from "@/lib/validation";

const schema = z.object({ studentIds: z.array(zId).min(1).max(200), classId: zId, date: zDate });

/** Move several students (e.g. before removing a class). Each move is its own transaction. */
export const POST = route(async (req) => {
  const ctx = await apiCtx();
  const { studentIds, classId, date } = await parseBody(req, schema);
  let moved = 0;
  const failed: { id: string; message: string }[] = [];
  for (const id of studentIds) {
    try {
      await moveStudent(ctx, id, { classId, date });
      moved++;
    } catch (err) {
      if (err instanceof ApiError && err.status !== 403) failed.push({ id, message: err.message });
      else throw err;
    }
  }
  return { moved, failed };
});
