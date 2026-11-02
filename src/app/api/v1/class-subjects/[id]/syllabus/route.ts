import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { zDate, zId } from "@/lib/validation";
import { getSyllabus, saveSyllabus } from "@/server/modules/progress";

const topic = z.object({ id: zId.optional(), title: z.string().trim().min(1).max(160), size: z.number().int().min(1).max(20) });
const chapter = z.object({ id: zId.optional(), title: z.string().trim().min(1).max(160), targetDate: zDate.nullable().optional(), topics: z.array(topic).max(200) });
const schema = z.object({ books: z.array(z.object({ id: zId.optional(), title: z.string().trim().min(1).max(160), chapters: z.array(chapter).max(100) })).max(10) });

export const GET = route<{ id: string }>(async (_req, { id }) => getSyllabus(await apiCtx(), id));
export const PUT = route<{ id: string }>(async (req, { id }) => saveSyllabus(await apiCtx(), id, await parseBody(req, schema)));
