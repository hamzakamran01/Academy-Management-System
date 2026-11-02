import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { requireCtx } from "@/server/auth/session";
import { getAcademySettings } from "@/server/modules/admin";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireCtx(["super_admin"]);
  const data = await getAcademySettings(ctx);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Only the owner can change these" back="/more" />
      <SettingsForm initial={data} />
    </div>
  );
}
