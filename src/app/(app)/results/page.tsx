import { ChevronRight, ClipboardList, GraduationCap, Sheet as SheetIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/field";
import { LinkTabs } from "@/components/ui/tabs";
import { todayPkt } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { fmtMark } from "@/lib/grades";
import { isStaffAdmin } from "@/lib/roles";
import { uuidOrUndefined } from "@/lib/validation";
import { requireCtx } from "@/server/auth/session";
import { listClasses } from "@/server/modules/org";
import { classSubjectOptions, listAssessments, TYPE_LABEL } from "@/server/modules/results";
import { CreateExamButton, CreateTestButton } from "./create-test";
import { ParentResults } from "./parent-results";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ tab?: string; classId?: string; student?: string; test?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  if (ctx.role === "parent") return <ParentResults ctx={ctx} studentId={uuidOrUndefined(sp.student)} highlight={uuidOrUndefined(sp.test)} />;

  const tab = sp.tab === "published" ? "published" : "draft";
  const classId = uuidOrUndefined(sp.classId);
  const admin = isStaffAdmin(ctx.role);
  const [items, options, classes, draftCount] = await Promise.all([
    listAssessments(ctx, { classId, status: tab }),
    classSubjectOptions(ctx),
    listClasses(ctx),
    listAssessments(ctx, { classId, status: "draft" }).then((r) => r.length),
  ]);
  const q = (t: string) => `/results?tab=${t}${classId ? `&classId=${classId}` : ""}`;
  const sheetCs = classId ? options.filter((o) => o.classId === classId) : [];

  return (
    <>
      <PageHeader
        title="Results"
        subtitle={ctx.role === "teacher" ? "Your tests and marks" : "Tests across all classes"}
        actions={
          <div className="flex gap-2">
            {admin && <CreateExamButton classes={classes.map((c) => ({ id: c.id, name: c.name }))} today={todayPkt()} />}
            <CreateTestButton options={options} today={todayPkt()} />
          </div>
        }
      />
      <form className="mb-2 flex gap-2" action="/results">
        <input type="hidden" name="tab" value={tab} />
        <Select name="classId" defaultValue={classId ?? ""} className="h-10 w-auto min-w-40 text-sm" aria-label="Class">
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <button className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">Filter</button>
      </form>
      {sheetCs.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {sheetCs.map((o) => (
            <ButtonLink key={o.id} href={`/results/sheet/${o.id}`} variant="secondary" size="sm" className="shrink-0">
              <SheetIcon aria-hidden /> {o.subjectName} sheet
            </ButtonLink>
          ))}
        </div>
      )}
      <LinkTabs
        tabs={[
          { key: "draft", label: "To finish", href: q("draft"), count: draftCount },
          { key: "published", label: "Published", href: q("published") },
        ]}
        active={tab}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={tab === "draft" ? ClipboardList : GraduationCap}
          title={tab === "draft" ? "Nothing to finish" : "No published results yet"}
          description={tab === "draft" ? "Create a test, type marks in front of names, then publish." : "Published tests appear here."}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          {items.map((a) => (
            <li key={a.id}>
              <Link href={`/results/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 active:bg-surface-3">
                <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                  <span className="text-[11px] font-semibold uppercase leading-none">{formatDate(a.date).split(" ")[1]}</span>
                  <span className="text-lg font-bold leading-tight">{a.date.slice(8)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="truncate text-[13px] text-muted">
                    {a.subjectName} · {a.className} · {TYPE_LABEL[a.type]} · /{fmtMark(a.totalMarks)}
                  </p>
                  {a.correctionRequestedAt && a.status === "published" && <Badge tone="info" className="mt-1">Correction requested</Badge>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={a.status} />
                  {a.status !== "published" && <span className="tabular text-xs text-muted">{a.entered} entered</span>}
                </div>
                <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
