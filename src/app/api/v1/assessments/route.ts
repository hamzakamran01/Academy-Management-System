import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, parseQuery, route } from "@/server/http";
import { createAssessment, listAssessments } from "@/server/modules/results";
import { assessmentSchema } from "@/lib/schemas";

const query = z.object({ classId: z.string().uuid().optional(), status: z.enum(["draft", "published", "all"]).optional() });

export const GET = route(async (req) => listAssessments(await apiCtx(), parseQuery(req, query)));
export const POST = route(async (req) => createAssessment(await apiCtx(), await parseBody(req, assessmentSchema)));
