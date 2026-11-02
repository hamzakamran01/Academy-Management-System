import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { isStaffAdmin } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { listAnnouncements } from "@/server/modules/announcements";
import { listClasses } from "@/server/modules/org";
import { AnnouncementFeed, ComposeButton } from "./announcements-client";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const ctx = await requireCtx();
  const staff = isStaffAdmin(ctx.role);
  const canPost = staff || ctx.role === "teacher";
  const [items, classes] = await Promise.all([listAnnouncements(ctx), canPost ? listClasses(ctx) : Promise.resolve([])]);
  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={canPost ? "Post to parents, teachers or specific classes" : "News from your academy"}
        back="/more"
        actions={canPost && classes.length > 0 && <ComposeButton classes={classes.map((c) => ({ id: c.id, name: c.name }))} teacherOnly={ctx.role === "teacher"} />}
      />
      {items.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" description={canPost ? "Share holidays, events and important notices." : undefined} />
      ) : (
        <AnnouncementFeed items={items.map((a) => ({ ...a, publishedAt: a.publishedAt.toISOString() }))} me={ctx.userId} isStaff={staff} />
      )}
    </>
  );
}
