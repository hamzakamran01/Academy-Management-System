import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { markFee } from "@/server/modules/fees";

export const POST = route<{ id: string }>(async (_req, { id }) => markFee(await apiCtx(), id, "unpaid"));
