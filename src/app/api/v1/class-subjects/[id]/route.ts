import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { removeClassSubject } from "@/server/modules/org";

export const DELETE = route<{ id: string }>(async (_req, { id }) => removeClassSubject(await apiCtx(), id));
