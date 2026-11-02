import { ChevronRight, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { addDays, todayPkt, weekStart } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { myTeachingToday } from "@/server/modules/progress";

export const metadata: Metadata = { title: "Weekly plans" };

export default async function PlansPage() {
  const ctx = await requireCtx(["teacher"]);
  const rows = await myTeachingToday(ctx);
  const ws = weekStart(todayPkt());
  const due = rows.filter((r) => r.planStatus !== "submitted").length;
  return (
    <>
      <PageHeader title="Weekly plans" subtitle={`Week of ${formatDate(ws)} – ${formatDate(addDays(ws, 5))}${due ? ` · ${due} to submit` : " · all submitted"}`} />
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No subjects assigned" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/plans/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.subjectName}</p>
                  <p className="truncate text-[13px] text-muted">{r.className}</p>
                </div>
                <StatusBadge status={r.planStatus === "submitted" ? "submitted" : r.planStatus === "draft" ? "draft" : "missing"} label={r.planStatus ? undefined : "Not started"} />
                <ChevronRight className="size-5 text-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
