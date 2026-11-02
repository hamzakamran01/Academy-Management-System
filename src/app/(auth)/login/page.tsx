import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCtx } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (await getCtx()) redirect("/home");
  const { expired } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-1.5 text-[15px] text-muted">Use the mobile number registered with your academy.</p>
      <LoginForm expired={expired === "1"} />
    </>
  );
}
