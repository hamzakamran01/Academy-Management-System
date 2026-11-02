import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { studentFeeRows } from "@/server/modules/fees";

export const GET = route<{ id: string }>(async (_req, { id }) => studentFeeRows(await apiCtx(), id));
