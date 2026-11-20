import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MonthPicker } from "@/components/month-picker";
import { PageHeader } from "@/components/shell/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { monthStart, todayPkt } from "@/lib/dates";
import { formatMonth } from "@/lib/format";
import { isStaffAdmin } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { classFeeList, monthOptions } from "@/server/modules/fees";
import { GenerateButton } from "../../generate-button";
import { FeeMarker } from "./fee-marker";

export const metadata: Metadata = { title: "Class fees" };

export default async function ClassFeesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string; charge?: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const months = await monthOptions(ctx.academyId);
  const current = monthStart(todayPkt());
  const month = sp.month && months.includes(sp.month) ? sp.month : current;
  const data = await classFeeList(ctx, id, month).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });

  const isPaper = sp.charge === "paper";
  const classHref = `/fees/class/${id}?month=${month}`;
  const rows = isPaper ? data.rows.filter((row) => row.paperAmount != null).map((row) => ({
    ...row,
    amount: row.paperAmount!,
    status: row.paperPaidAt ? "paid" as const : "unpaid" as const,
    markedAt: row.paperPaidAt ?? null,
    markedByName: null,
  })) : data.rows;

  return (
    <>
      <PageHeader title={data.class.name} subtitle={`Fees · ${formatMonth(month)}`} back={`/fees?month=${month}`} />
      <div className="mb-4 flex justify-center sm:justify-start">
        <MonthPicker months={months} value={month} />
      </div>
      <LinkTabs
        active={isPaper ? "paper" : "monthly"}
        tabs={[
          { key: "monthly", label: "Monthly fee", href: classHref },
          { key: "paper", label: "Paper money", href: `${classHref}&charge=paper`, count: data.rows.filter((row) => row.paperAmount != null).length },
        ]}
      />
      {isPaper && data.rows.length > 0 && rows.length === 0 ? (
        <EmptyState icon={Receipt} title="No paper money charges this month" description="Set a student's paper money amount and apply it to this month to collect it here."
          action={ctx.role === "super_admin" && <ButtonLink href={`/fees/settings?classId=${id}`} variant="secondary">Set student fees</ButtonLink>} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={`No fee list for ${formatMonth(month)} yet`}
          description={isStaffAdmin(ctx.role) ? "Fee rows are created automatically on the 1st. You can create them now." : "The office creates the monthly list on the 1st."}
          action={isStaffAdmin(ctx.role) && <GenerateButton month={month} />}
        />
      ) : (
        <FeeMarker
          key={`${month}-${isPaper}`}
          initial={rows.map((r) => ({ ...r, markedAt: r.markedAt?.toISOString() ?? null }))}
          isPaper={isPaper}
          canMark={month <= current}
          isOwner={!isPaper && ctx.role === "super_admin"}
          showAmounts={ctx.role !== "teacher"}
        />
      )}
    </>
  );
}
