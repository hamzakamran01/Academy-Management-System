import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { createSubject, listSubjects } from "@/server/modules/org";

const schema = z.object({ name: z.string().trim().min(1, "Enter a subject name").max(60), code: z.string().max(12).optional().nullable() });

export const GET = route(async () => listSubjects((await apiCtx()).academyId));
export const POST = route(async (req) => createSubject(await apiCtx(), await parseBody(req, schema)));
