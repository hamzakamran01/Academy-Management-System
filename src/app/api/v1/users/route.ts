import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { createAccount } from "@/server/modules/users";
import { zName, zRole } from "@/lib/validation";

const schema = z.object({ name: zName, phone: z.string().min(1, "Enter a mobile number"), role: zRole });

export const POST = route(async (req) => createAccount(await apiCtx(), await parseBody(req, schema)));
