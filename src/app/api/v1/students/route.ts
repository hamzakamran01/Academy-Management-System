import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, parseQuery, route } from "@/server/http";
import { addStudent, listStudents } from "@/server/modules/students";
import { studentSchema } from "@/lib/schemas";

const query = z.object({
  q: z.string().max(80).optional(),
  classId: z.string().uuid().optional(),
  status: z.enum(["active", "removed", "all"]).optional(),
  feeStatus: z.enum(["paid", "unpaid"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const GET = route(async (req) => listStudents(await apiCtx(), parseQuery(req, query)));
export const POST = route(async (req) => addStudent(await apiCtx(), await parseBody(req, studentSchema)));
