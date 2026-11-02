import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { Notice } from "@/components/ui/feedback";
import { ROLE_LABEL } from "@/lib/roles";
import { uuidOrUndefined } from "@/lib/validation";
import { requireCtx } from "@/server/auth/session";
import { getAcademy } from "@/server/modules/academy";
import { adminDashboard, ownerDashboard, parentDashboard, teacherDashboard } from "@/server/modules/dashboards";
import { AdminHome } from "./admin-home";
import { OwnerHome } from "./owner-home";
import { ParentHome } from "./parent-home";
import { TeacherHome } from "./teacher-home";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Role homes (PRD §4.2, FR-DSH-01…04). */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string; denied?: string; student?: string }> }) {
  const ctx = await requireCtx();
  const [academy, sp] = await Promise.all([getAcademy(ctx.academyId), searchParams]);
  const first = ctx.name.split(" ")[0];

  let body: React.ReactNode;
  if (ctx.role === "super_admin") body = <OwnerHome d={await ownerDashboard(ctx)} />;
  else if (ctx.role === "admin") body = <AdminHome d={await adminDashboard(ctx)} />;
  else if (ctx.role === "teacher") body = <TeacherHome d={await teacherDashboard(ctx)} />;
  else body = <ParentHome d={await parentDashboard(ctx, uuidOrUndefined(sp.student))} />;

  return (
    <>
      <PageHeader title={`${greeting()}, ${first}`} subtitle={`${academy.name} · ${ROLE_LABEL[ctx.role]}`} bell />
      {sp.welcome === "1" && (
        <Notice tone="success" className="mb-4" title="You're all set">
          Your password is saved. Add {APP_NAME} to your home screen from More → Install app.
        </Notice>
      )}
      {sp.denied === "1" && <Notice tone="warning" className="mb-4">That page isn't available for your role.</Notice>}
      {body}
    </>
  );
}
