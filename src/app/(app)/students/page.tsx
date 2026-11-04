import { ChevronRight, Library, UserMinus, UserPlus, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClassBadge } from "@/components/class-badge";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/cn";
import { todayPkt } from "@/lib/dates";
import { isStaffAdmin } from "@/lib/roles";
import { uuidOrUndefined } from "@/lib/validation";
import { requireCtx } from "@/server/auth/session";
import { listClasses } from "@/server/modules/org";
import { listStudents } from "@/server/modules/students";
import { StudentFilters, StudentSearch } from "./student-filters";
import { StudentList } from "./student-list";

export const metadata: Metadata = { title: "Students" };

const PAGE_SIZE = 10;

type SP = { q?: string; classId?: string; status?: string; feeStatus?: string; page?: string; move?: string };

/**
 * Students: pick a class first, then a calm, numbered list (10 per page).
 * Search works across all classes from the first screen.
 */
export default async function StudentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const raw = await searchParams;
  const sp = { ...raw, classId: uuidOrUndefined(raw.classId) };
  const admin = isStaffAdmin(ctx.role);
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const status = admin && (sp.status === "removed" || sp.status === "all") ? sp.status : "active";
  const q = sp.q?.trim() || undefined;
  const moveMode = admin && sp.move === "1" && !!sp.classId;
  const addHref = sp.classId ? `/students/new?classId=${sp.classId}` : "/students/new";

  const classes = await listClasses(ctx);
  // One "Add student" per screen, always on the search row — same place on phone and desktop.
  const addButton = (
    <ButtonLink href={addHref} className="shrink-0" aria-label="Add student">
      <UserPlus aria-hidden /> <span className="sm:hidden">Add</span>
      <span className="max-sm:hidden">Add student</span>
    </ButtonLink>
  );

  // ── Step 1: choose a class ────────────────────────────────────────────────
  if (!sp.classId && !q && status === "active") {
    const total = classes.reduce((n, c) => n + c.studentCount, 0);
    return (
      <>
        <PageHeader title="Students" subtitle={`${total.toLocaleString("en-PK")} active · choose a class`} />
        <StudentSearch placeholder="Search any student" action={admin && classes.length > 0 ? addButton : undefined} />
        {classes.length === 0 ? (
          <EmptyState
            icon={Library}
            title={admin ? "No classes yet" : "No classes assigned"}
            description={admin ? "Add a class first, then add students to it." : "Ask the office to assign you to a class subject."}
            action={admin && <ButtonLink href="/classes">Open classes</ButtonLink>}
          />
        ) : (
          <ul className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/students?classId=${c.id}`}
                  className="group flex items-center gap-3.5 rounded-xl border border-border bg-surface p-4 shadow-card transition-[background-color,transform,box-shadow] hover:bg-surface-2 hover:shadow-raised active:scale-[0.985]"
                >
                  <ClassBadge name={c.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{c.name}</span>
                    <span className="block text-[13px] text-muted">
                      <span className="tabular font-medium text-fg">{c.studentCount}</span> student{c.studentCount === 1 ? "" : "s"}
                      {c.shift ? ` · ${c.shift}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
            {admin && (
              // Sits in the grid as one more tile, so it lines up with the classes.
              <li>
                <Link
                  href="/students?status=removed"
                  className="group flex h-full items-center gap-3.5 rounded-xl border border-dashed border-border bg-surface/60 p-4 transition-[background-color,transform] hover:bg-surface-2 active:scale-[0.985]"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-muted">
                    <UserMinus className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">Removed students</span>
                    <span className="block text-[13px] text-muted">View history or re-admit</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            )}
          </ul>
        )}
      </>
    );
  }

  // ── Step 2: one class (or a search across classes) ───────────────────────
  const { items, total } = await listStudents(ctx, {
    q,
    classId: sp.classId,
    status,
    feeStatus: admin && sp.feeStatus === "unpaid" ? "unpaid" : undefined,
    limit: moveMode ? 200 : PAGE_SIZE,
    offset: moveMode ? 0 : (page - 1) * PAGE_SIZE,
  });
  const cls = classes.find((c) => c.id === sp.classId);
  const filtered = !!(q || (admin && sp.feeStatus));
  const pageHref = (n: number) => {
    const p = new URLSearchParams(Object.entries({ ...raw, page: n > 1 ? String(n) : "" }).filter(([, v]) => v) as [string, string][]);
    return `/students?${p.toString()}`;
  };
  const title = moveMode ? "Move students" : cls ? cls.name : status === "removed" ? "Removed students" : "Search results";
  // An empty class shows one big "Add student" in its empty state, so the
  // search-row button steps aside — never two "Add student" buttons at once.
  const emptyClass = items.length === 0 && !filtered && admin && !!cls;
  const showAdd = admin && !moveMode && !emptyClass && status === "active";

  return (
    <>
      <PageHeader
        title={title}
        subtitle={`${total.toLocaleString("en-PK")} ${status === "removed" ? "removed" : status === "all" ? "total" : "student" + (total === 1 ? "" : "s")}${q ? ` matching “${q}”` : ""}`}
        back={moveMode ? `/classes/${sp.classId}` : "/students"}
      />
      {!moveMode && (
        <>
          {classes.length > 1 && (cls || !q) && (
            <nav className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0" aria-label="Classes">
              {classes.map((c) => (
                <Link
                  key={c.id}
                  href={`/students?classId=${c.id}`}
                  aria-current={c.id === sp.classId ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium transition-[background-color,transform] active:scale-95",
                    c.id === sp.classId ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg hover:bg-surface-2",
                  )}
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          )}
          <StudentFilters showStatus={admin && !!cls} showFee={admin && !!cls} inClass={!!cls} action={showAdd ? addButton : undefined} />
        </>
      )}

      {emptyClass ? (
        <EmptyState
          icon={UserPlus}
          title={`No students in ${cls.name} yet`}
          description="Add the first student — their parent can sign in the same day."
          action={
            <ButtonLink href={addHref} size="lg">
              <UserPlus aria-hidden /> Add student
            </ButtonLink>
          }
          className="rounded-2xl border border-dashed border-border bg-surface py-14"
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={filtered ? "No students match" : cls ? "No students in this class yet" : "No students found"}
          description={filtered ? "Try a different search or clear the filters." : undefined}
        />
      ) : (
        <>
          <StudentList
            rows={items}
            moveMode={moveMode}
            classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            currentClassId={sp.classId}
            today={todayPkt()}
            showFee={admin}
            showClass={!cls}
            startIndex={moveMode ? 0 : (page - 1) * PAGE_SIZE}
          />
          {!moveMode && <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={pageHref} />}
        </>
      )}
    </>
  );
}
