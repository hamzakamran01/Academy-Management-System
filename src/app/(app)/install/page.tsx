import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { requireCtx } from "@/server/auth/session";
import { CATEGORIES, getPrefs } from "@/server/modules/notifications";
import { InstallCard, PushCard } from "./install-client";

export const metadata: Metadata = { title: "App & notifications" };

export default async function InstallPage() {
  const ctx = await requireCtx();
  const prefs = await getPrefs(ctx);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="App & notifications" back="/more" />
      <InstallCard />
      <PushCard
        vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null}
        categories={CATEGORIES.filter((c) => c.roles.includes(ctx.role)).map(({ key, label }) => ({ key, label }))}
        initialMuted={prefs.mutedPush}
        initialSummary={prefs.dailySummary}
        isParent={ctx.role === "parent"}
      />
    </div>
  );
}
