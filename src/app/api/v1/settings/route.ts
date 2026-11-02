import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { getAcademySettings, updateAcademySettings } from "@/server/modules/admin";
import { settingsSchema } from "@/lib/settings";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the academy name").max(120),
  address: z.string().trim().max(300).nullable(),
  phone: z.string().trim().max(30).nullable(),
  settings: settingsSchema,
});

export const GET = route(async () => getAcademySettings(await apiCtx()));
export const PUT = route(async (req) => updateAcademySettings(await apiCtx(), await parseBody(req, schema)));
