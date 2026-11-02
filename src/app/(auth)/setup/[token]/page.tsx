import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { formatPhone } from "@/lib/phone";
import { findSetupToken } from "@/server/modules/auth";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Set your password", robots: { index: false } };

export default async function SetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = token.length >= 20 && token.length <= 100 ? await findSetupToken(token) : null;

  if (!found) {
    return (
      <EmptyState
        className="py-6"
        icon={LinkIcon}
        title="This link has expired"
        description="Setup links work once and last 7 days. Ask the academy office to send you a new one."
        action={<ButtonLink href="/login" variant="secondary">Go to sign in</ButtonLink>}
      />
    );
  }

  const firstName = found.name.split(" ")[0];
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">
        {found.isReset ? "Reset your password" : `Welcome, ${firstName}`}
      </h1>
      <p className="mt-1.5 text-[15px] text-muted">
        Create a password for <span className="font-semibold text-fg">{formatPhone(found.phone)}</span>. You'll use it with your
        mobile number to sign in.
      </p>
      <SetupForm token={token} phone={found.phone} />
    </>
  );
}
