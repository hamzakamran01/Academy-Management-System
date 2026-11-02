import { z } from "zod";
import { apiCtx } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { addHoliday, listHolidays } from "@/server/modules/org";
import { zDate } from "@/lib/validation";

const schema = z.object({ name: z.string().trim().min(2, "Enter a name").max(80), startDate: zDate, endDate: zDate });

export const GET = route(async () => listHolidays((await apiCtx()).academyId));
export const POST = route(async (req) => addHoliday(await apiCtx(), await parseBody(req, schema)));
