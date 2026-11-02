import { BellOff, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireCtx } from "@/server/auth/session";
import { listNotifications } from "@/server/modules/notifications";
import { NotificationList } from "./notification-list";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

/** FR-NOT-02: notification centre with unread state and tap-to-open. */
export default async function NotificationsPage() {
  const ctx = await requireCtx();
  const items = await listNotifications(ctx);
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <ButtonLink href="/install" variant="ghost" size="icon" aria-label="Notification settings">
            <Settings2 />
          </ButtonLink>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={BellOff} title="You're all caught up" description="Results, homework, fee updates and announcements will show up here." />
      ) : (
        <NotificationList items={items.map((n) => ({ ...n, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))} />
      )}
    </>
  );
}
