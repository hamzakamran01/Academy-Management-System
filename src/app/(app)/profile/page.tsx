import { Bell, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Avatar, DescriptionList } from "@/components/ui/data";
import { formatPhone } from "@/lib/phone";
import { ROLE_LABEL } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { getAcademy } from "@/server/modules/academy";
import { NameCard, SecurityCard } from "./profile-client";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Profile" };

/** FR-AUTH-10 / P-10 / T-16 */
export default async function ProfilePage() {
  const ctx = await requireCtx();
  const academy = await getAcademy(ctx.academyId);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Profile & security" back="/more" />
      <Card>
        <CardBody className="flex items-center gap-4 pt-4">
          <Avatar name={ctx.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{ctx.name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ctx.roles.map((r) => (
                <Badge key={r} tone={r === ctx.role ? "primary" : "neutral"}>{ROLE_LABEL[r]}</Badge>
              ))}
            </div>
          </div>
        </CardBody>
        <CardBody>
          <DescriptionList items={[{ label: "Mobile", value: formatPhone(ctx.phone) }, { label: "Academy", value: academy.name }]} />
        </CardBody>
      </Card>
      <NameCard name={ctx.name} />
      <Card>
        <CardBody className="flex items-center justify-between gap-4 pt-4">
          <div>
            <p className="font-medium">Appearance</p>
            <p className="text-[13px] text-muted">Light is the default</p>
          </div>
          <ThemeToggle className="w-48" />
        </CardBody>
      </Card>
      <Link href="/install" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card hover:bg-surface-2">
        <Bell className="size-5 text-muted" aria-hidden />
        <span className="flex-1 font-medium">App & notifications</span>
        <ChevronRight className="size-5 text-subtle" aria-hidden />
      </Link>
      <SecurityCard strong={ctx.roles.includes("super_admin")} phone={ctx.phone} />
    </div>
  );
}
