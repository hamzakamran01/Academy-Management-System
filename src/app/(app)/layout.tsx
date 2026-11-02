import { and, count, eq, isNull } from "drizzle-orm";
import { BottomNav, Sidebar } from "@/components/shell/nav";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { requireCtx } from "@/server/auth/session";
import { getAcademy } from "@/server/modules/academy";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const [academy, [unread]] = await Promise.all([
    getAcademy(ctx.academyId),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.userId), eq(notifications.role, ctx.role), isNull(notifications.readAt))),
  ]);

  return (
    <div className="min-h-dvh">
      <OfflineBanner />
      <Sidebar role={ctx.role} roles={ctx.roles} name={ctx.name} academyName={academy.name} unread={unread?.n ?? 0} />
      <div className="lg:ps-[264px]">
        <main className="mx-auto w-full max-w-6xl px-4 pb-nav sm:px-6 lg:px-10 lg:pt-8">{children}</main>
      </div>
      <BottomNav role={ctx.role} />
    </div>
  );
}
