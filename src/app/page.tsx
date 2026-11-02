import { redirect } from "next/navigation";
import { getCtx } from "@/server/auth/session";

export default async function Root() {
  redirect((await getCtx()) ? "/home" : "/login");
}
