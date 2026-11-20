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
import { classPaperRates, studentFeeSettings } from "@/server/modules/fees";
import { listClasses } from "@/server/modules/org";
import { listStudents } from "@/server/modules/students";
import { StudentSearch } from "../../students/student-filters";
import { ClassPaperEditor, StudentFeeEditor } from "./fee-settings-client";

export const metadata: Metadata = { title: "Student fees" };

const pageSize = 25;

export default async function FeeSettingsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; missing?: string; classId?: string }> }) {
  const ctx = await requireCtx(["super_admin"]);
  const [params, classes] = await Promise.all([searchParams, listClasses(ctx)]);
  const selected = classes.find((cls) => cls.id === params.classId);
  const q = typeof params.q === "string" ? params.q.slice(0, 80).trim() : "";
  const missingFee = params.missing === "1";
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000 ? requestedPage : 1;
  const showStudents = Boolean(selected || q);
  const { items, total } = showStudents
    ? await listStudents(ctx, { q, classId: selected?.id, missingFee, status: "active", limit: pageSize, offset: (page - 1) * pageSize })
    : { items: [], total: 0 };
  const rateClassIds = [...new Set([...(selected ? [selected.id] : []), ...items.flatMap((student) => student.classId ? [student.classId] : [])])];
  const [feeSettings, classRates] = await Promise.all([
    studentFeeSettings(ctx, items.map((student) => student.id)),
    classPaperRates(ctx, rateClassIds),
  ]);
  const settings = new Map(feeSettings.map((fee) => [fee.studentId, fee]));
  const rates = new Map(classRates.map((rate) => [rate.id, rate.paperFee]));
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number, missing = missingFee, classId = selected?.id, term = q) => `/fees/settings?${new URLSearchParams({ ...(term ? { q: term } : {}), ...(classId ? { classId } : {}), ...(missing ? { missing: "1" } : {}), page: String(p) })}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Student fees" subtitle="Manage monthly fees and paper money" back="/fees" />
      <nav aria-label="Classes" className="mb-4 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap">
        {classes.map((cls) => (
          <Link key={cls.id} href={href(1, missingFee, cls.id, "")} aria-current={selected?.id === cls.id ? "page" : undefined}
            className={buttonVariants({ variant: selected?.id === cls.id ? "primary" : "secondary", className: "min-h-12 shrink-0" })}>
            {cls.name}{cls.shift ? ` · ${cls.shift}` : ""}
          </Link>
        ))}
      </nav>
      {selected && <ClassPaperEditor key={selected.id} classId={selected.id} name={selected.name} amount={rates.get(selected.id) ?? null} />}
      <StudentSearch key={selected?.id ?? "all"} placeholder={selected ? `Search in ${selected.name}` : "Search students by name"} />
      <nav aria-label="Fee filters" className="mb-4 flex flex-wrap gap-2">
        <Link href={href(1, false)} aria-current={!missingFee ? "page" : undefined} className={buttonVariants({ variant: missingFee ? "secondary" : "soft", className: "min-h-12" })}>All students</Link>
        <Link href={href(1, true)} aria-current={missingFee ? "page" : undefined} className={buttonVariants({ variant: missingFee ? "soft" : "secondary", className: "min-h-12" })}>Fee needed</Link>
      </nav>
      {!showStudents ? (
        <EmptyState icon={Wallet} title={classes.length ? "Choose a class" : "No active classes"} description="You can also search for a student by name." />
      ) : items.length ? (
        <ListCard>
          {items.map((student) => {
            const fee = settings.get(student.id);
            const classPaperFee = student.classId ? rates.get(student.classId) : null;
            const paperFee = fee?.paperFee ?? classPaperFee;
            return (
              <li key={student.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-5">
                <Avatar name={student.name} size="sm" />
                <div className="min-w-0">
                  <Link className="block break-words font-semibold hover:text-primary hover:underline" href={`/students/${student.id}?tab=fees`}>{student.name}</Link>
                  <p className="break-words text-xs text-muted">{student.className ?? "No class"} · {student.registrationNo}</p>
                  <div className="mt-1 space-y-0.5 text-sm">{fee ? <>
                    <p>Monthly fee <strong className="tabular">{formatMoney(fee.monthlyFee)}</strong></p>
                    <p>Paper money <strong className="tabular">{paperFee ? formatMoney(paperFee) : "No charge"}</strong> <span className="text-xs text-muted">· {fee.paperFee == null ? "Class rate" : "Individual"}</span></p>
                  </> : <Badge tone="warning">Fee needed</Badge>}</div>
                </div>
                <StudentFeeEditor studentId={student.id} name={student.name} monthlyFee={fee?.monthlyFee} paperFee={fee?.paperFee} classPaperFee={classPaperFee} note={fee?.note} />
              </li>
            );
          })}
        </ListCard>
      ) : (
        <EmptyState icon={q ? Search : Wallet} title={q ? "No matching students" : missingFee ? "No students in this class need a fee" : "No students found"} description={q ? "Try a different name, registration number or phone number." : missingFee ? undefined : "Admit a student to set their monthly fee."} />
      )}
      {showStudents && (lastPage > 1 || page > 1) && (
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
