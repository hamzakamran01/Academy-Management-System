import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { CardLink } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { MENU } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { getAcademy } from "@/server/modules/academy";

export const metadata: Metadata = { title: "Home" };

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Role home. Full dashboards (PRD §4.2) are composed here in the Dashboards phase. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string; denied?: string }> }) {
  const ctx = await requireCtx();
  const [academy, sp] = await Promise.all([getAcademy(ctx.academyId), searchParams]);
  const items = MENU[ctx.role].flatMap((g) => g.items).filter((i) => i.href !== "/home");

  return (
    <>
      <PageHeader title={`${greeting()}, ${ctx.name.split(" ")[0]}`} subtitle={`${academy.name} · ${ROLE_LABEL[ctx.role]}`} bell />
      {sp.welcome === "1" && (
        <Notice tone="success" className="mb-4" title="You're all set">
          Your password is saved. Add Campusly to your home screen for one-tap access.
        </Notice>
      )}
      {sp.denied === "1" && (
        <Notice tone="warning" className="mb-4">That page isn't available for your role.</Notice>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <CardLink href={href}>
              <span className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="font-medium">{label}</span>
              </span>
            </CardLink>
          </li>
        ))}
      </ul>
    </>
  );
}
