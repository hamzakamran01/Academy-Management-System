import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { markSalary } from "@/server/modules/salaries";

export const POST = route<{ id: string }>(async (_req, { id }) => markSalary(await apiCtx(), id, "pending"));
