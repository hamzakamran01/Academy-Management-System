import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { createClass, listClasses } from "@/server/modules/org";
import { classSchema } from "@/lib/schemas";

export const GET = route(async () => listClasses(await apiCtx()));
export const POST = route(async (req) => createClass(await apiCtx(), await parseBody(req, classSchema)));
