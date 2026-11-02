import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { updateYear } from "@/server/modules/org";
import { zDate } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(1).max(20).optional(),
  startDate: zDate.optional(),
  endDate: zDate.optional(),
  workingDays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
});

export const PATCH = route<{ id: string }>(async (req, { id }) => updateYear(await apiCtx(), id, await parseBody(req, schema)));
