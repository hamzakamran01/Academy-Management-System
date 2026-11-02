import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { updateSubject } from "@/server/modules/org";

const schema = z.object({ name: z.string().trim().min(1).max(60).optional(), code: z.string().max(12).optional().nullable(), archived: z.boolean().optional() });

export const PATCH = route<{ id: string }>(async (req, { id }) => updateSubject(await apiCtx(), id, await parseBody(req, schema)));
