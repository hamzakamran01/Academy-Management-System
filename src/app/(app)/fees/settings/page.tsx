import { ChevronLeft, ChevronRight, Search, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, ListCard } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { formatMoney } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { studentFeeSettings } from "@/server/modules/fees";
import { listStudents } from "@/server/modules/students";
import { StudentSearch } from "../../students/student-filters";
import { StudentFeeEditor } from "./fee-settings-client";

export const metadata: Metadata = { title: "Student fees" };

const pageSize = 25;

export default async function FeeSettingsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; missing?: string }> }) {
  const ctx = await requireCtx(["super_admin"]);
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 80).trim() : "";
  const missingFee = params.missing === "1";
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000 ? requestedPage : 1;
  const { items, total } = await listStudents(ctx, { q, missingFee, status: "active", limit: pageSize, offset: (page - 1) * pageSize });
  const settings = new Map((await studentFeeSettings(ctx, items.map((student) => student.id))).map((fee) => [fee.studentId, fee]));
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number, missing = missingFee) => `/fees/settings?${new URLSearchParams({ ...(q ? { q } : {}), ...(missing ? { missing: "1" } : {}), page: String(p) })}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Student fees" subtitle="Set and update each student’s monthly fee" back="/fees" />
      <StudentSearch placeholder="Search by name, registration or phone" />
      <nav aria-label="Fee filters" className="mb-4 flex flex-wrap gap-2">
        <Link href={href(1, false)} aria-current={!missingFee ? "page" : undefined} className={buttonVariants({ variant: missingFee ? "secondary" : "soft", className: "min-h-12" })}>All students</Link>
        <Link href={href(1, true)} aria-current={missingFee ? "page" : undefined} className={buttonVariants({ variant: missingFee ? "soft" : "secondary", className: "min-h-12" })}>Fee needed</Link>
      </nav>
      {items.length ? (
        <ListCard>
          {items.map((student) => {
            const fee = settings.get(student.id);
            return (
              <li key={student.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-5">
                <Avatar name={student.name} size="sm" />
                <div className="min-w-0">
                  <Link className="block break-words font-semibold hover:text-primary hover:underline" href={`/students/${student.id}?tab=fees`}>{student.name}</Link>
                  <p className="break-words text-xs text-muted">{student.className ?? "No class"} ? {student.registrationNo}</p>
                  <div className="mt-1">{fee ? <span className="tabular text-sm font-semibold">{formatMoney(fee.monthlyFee)}</span> : <Badge tone="warning">Fee needed</Badge>}</div>
                </div>
                <StudentFeeEditor studentId={student.id} name={student.name} monthlyFee={fee?.monthlyFee} note={fee?.note} />
              </li>
            );
          })}
        </ListCard>
      ) : (
        <EmptyState icon={q ? Search : Wallet} title={q ? "No matching students" : missingFee ? "All active students have fees" : "No students on this page"} description={q ? "Try a different name, registration number or phone number." : missingFee ? undefined : "Admit a student to set their monthly fee."} />
      )}
      {(lastPage > 1 || page > 1) && (
        <nav aria-label="Student fee pages" className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted">Page {Math.min(page, lastPage)} of {lastPage}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={href(Math.min(page - 1, lastPage))} className={buttonVariants({ variant: "secondary" })} aria-label="Previous page"><ChevronLeft aria-hidden /></Link>}
            {page < lastPage && <Link href={href(page + 1)} className={buttonVariants({ variant: "secondary" })} aria-label="Next page"><ChevronRight aria-hidden /></Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
