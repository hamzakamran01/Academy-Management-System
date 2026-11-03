import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MonthPicker } from "@/components/month-picker";
import { PageHeader } from "@/components/shell/page-header";
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

export default async function ClassFeesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const months = await monthOptions(ctx.academyId);
  const current = monthStart(todayPkt());
  const month = sp.month && months.includes(sp.month) ? sp.month : current;
  const data = await classFeeList(ctx, id, month).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });

  return (
    <>
      <PageHeader title={data.class.name} subtitle={`Fees · ${formatMonth(month)}`} back={`/fees?month=${month}`} />
      <div className="mb-4 flex justify-center sm:justify-start">
        <MonthPicker months={months} value={month} />
      </div>
      {data.rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={`No fee list for ${formatMonth(month)} yet`}
          description={isStaffAdmin(ctx.role) ? "Fee rows are created automatically on the 1st. You can create them now." : "The office creates the monthly list on the 1st."}
          action={isStaffAdmin(ctx.role) && <GenerateButton month={month} />}
        />
      ) : (
        <FeeMarker
          key={month}
          initial={data.rows.map((r) => ({ ...r, markedAt: r.markedAt?.toISOString() ?? null }))}
          canMark={month <= current}
          isOwner={ctx.role === "super_admin"}
          showAmounts={ctx.role !== "teacher"}
        />
      )}
    </>
  );
}
