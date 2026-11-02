import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { deleteHoliday } from "@/server/modules/org";

export const DELETE = route<{ id: string }>(async (_req, { id }) => deleteHoliday(await apiCtx(), id));
