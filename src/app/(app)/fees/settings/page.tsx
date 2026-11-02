import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { Notice } from "@/components/ui/feedback";
import { requireCtx } from "@/server/auth/session";
import { feeSettingsData } from "@/server/modules/fees";
import { listStudents } from "@/server/modules/students";
import { ClassFees, PersonalFees } from "./fee-settings-client";

export const metadata: Metadata = { title: "Fee settings" };

export default async function FeeSettingsPage() {
  const ctx = await requireCtx(["super_admin"]);
  const [data, { items }] = await Promise.all([feeSettingsData(ctx), listStudents(ctx, { status: "active", limit: 200 })]);
  const unset = data.classes.filter((c) => c.monthlyFee == null && c.students > 0);
  return (
    <>
      <PageHeader title="Fee settings" subtitle="Only the owner can set fee amounts" back="/fees" />
      {unset.length > 0 && (
        <Notice tone="warning" className="mb-4" title="Fee not set">
          {unset.map((c) => c.name).join(", ")} {unset.length === 1 ? "has" : "have"} no default fee — new fee rows there will be Rs 0.
        </Notice>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <ClassFees classes={data.classes} />
        <PersonalFees
          personal={data.personal}
          students={items.map((s) => ({ id: s.id, name: s.name, className: s.className, registrationNo: s.registrationNo }))}
        />
      </div>
    </>
  );
}
