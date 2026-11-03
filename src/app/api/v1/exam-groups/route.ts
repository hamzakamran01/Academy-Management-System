import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { createExamGroup } from "@/server/modules/results";
import { zDate, zId } from "@/lib/validation";

const schema = z.object({
  classId: zId,
  type: z.enum(["weekly", "monthly"]),
  title: z.string().trim().min(2).max(80),
  date: zDate,
  totalMarks: z.number().positive().max(1000),
});

export const POST = route(async (req) => createExamGroup(await apiCtx(), await parseBody(req, schema)));
