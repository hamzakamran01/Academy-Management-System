import { apiCtx } from "@/server/auth/session";
import { route } from "@/server/http";
import { mySalary } from "@/server/modules/salaries";

export const GET = route(async () => mySalary(await apiCtx()));
