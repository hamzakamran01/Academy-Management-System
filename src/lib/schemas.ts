import { z } from "zod";
import { zId } from "./validation";

/** Request schemas shared between client forms and API routes. */
export const classSchema = z.object({
  name: z.string().trim().min(1, "Enter a class name").max(60),
  level: z.coerce.number().int().min(0).max(99),
  shift: z.string().max(30).optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(500).optional().nullable(),
  classTeacherId: zId.optional().nullable(),
  subjectIds: z.array(zId).max(30).optional(),
});
