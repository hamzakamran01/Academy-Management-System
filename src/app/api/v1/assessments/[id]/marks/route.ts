import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { saveMarks } from "@/server/modules/results";

const schema = z.object({
  entries: z
    .array(z.object({ studentId: z.string().uuid(), value: z.number().nullable(), absent: z.boolean() }))
    .max(300),
});

export const PUT = route<{ id: string }>(async (req, { id }) => saveMarks(await apiCtx(), id, (await parseBody(req, schema)).entries));
