import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { archiveClass } from "@/server/modules/org";

export const POST = route<{ id: string }>(async (_req, { id }) => archiveClass(await apiCtx(), id));
