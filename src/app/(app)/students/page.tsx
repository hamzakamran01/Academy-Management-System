import { UserPlus, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { todayPkt } from "@/lib/dates";
import { isStaffAdmin } from "@/lib/roles";
import { uuidOrUndefined } from "@/lib/validation";
import { requireCtx } from "@/server/auth/session";
import { listClasses } from "@/server/modules/org";
import { listStudents } from "@/server/modules/students";
import { StudentFilters } from "./student-filters";
import { StudentList } from "./student-list";

export const metadata: Metadata = { title: "Students" };

const PAGE = 50;

type SP = { q?: string; classId?: string; status?: string; feeStatus?: string; page?: string; move?: string };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const raw = await searchParams;
  const sp = { ...raw, classId: uuidOrUndefined(raw.classId) };
  const admin = isStaffAdmin(ctx.role);
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status === "removed" || sp.status === "all" ? sp.status : "active";
  const moveMode = admin && sp.move === "1" && !!sp.classId;

  const [classes, { items, total }] = await Promise.all([
    listClasses(ctx),
    listStudents(ctx, {
      q: sp.q,
      classId: sp.classId,
      status,
      feeStatus: sp.feeStatus === "unpaid" ? "unpaid" : undefined,
      limit: moveMode ? 200 : PAGE * page,
    }),
  ]);
  const filtered = !!(sp.q || sp.classId || sp.feeStatus || status !== "active");
  const nextHref = (() => {
    const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    p.set("page", String(page + 1));
    return `/students?${p.toString()}`;
  })();

  return (
    <>
      <PageHeader
        title={moveMode ? "Move students" : "Students"}
        subtitle={`${total.toLocaleString("en-PK")} ${status === "removed" ? "removed" : status === "all" ? "total" : "active"}`}
        back={moveMode ? `/classes/${sp.classId}` : undefined}
        actions={
          admin &&
          !moveMode && (
            <ButtonLink href={sp.classId ? `/students/new?classId=${sp.classId}` : "/students/new"}>
              <UserPlus aria-hidden /> <span className="hidden sm:inline">Add student</span>
            </ButtonLink>
          )
        }
      />
      {!moveMode && <StudentFilters classes={classes.map((c) => ({ id: c.id, name: c.name }))} showStatus={admin} />}

      {items.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={filtered ? "No students match" : "No students yet"}
          description={filtered ? "Try a different search or clear the filters." : admin ? "Add your first student — the parent can sign in the same day." : "Students of your classes appear here."}
          action={!filtered && admin && <ButtonLink href="/students/new"><UserPlus aria-hidden /> Add student</ButtonLink>}
        />
      ) : (
        <>
          <StudentList
            rows={items}
            moveMode={moveMode}
            classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            currentClassId={sp.classId}
            today={todayPkt()}
            showFee={true}
          />
          {!moveMode && items.length < total && (
            <div className="mt-4 flex justify-center">
              <ButtonLink href={nextHref} variant="secondary" scroll={false}>
                Show more ({total - items.length} left)
              </ButtonLink>
            </div>
          )}
        </>
      )}
    </>
  );
}
