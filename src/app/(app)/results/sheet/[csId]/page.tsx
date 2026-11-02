import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate, formatPercent } from "@/lib/format";
import { fmtMark } from "@/lib/grades";
import { Sheet as SheetIcon } from "lucide-react";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { subjectResultSheet } from "@/server/modules/results";

export const metadata: Metadata = { title: "Result sheet" };

/** FR-RES-10: students × tests for one subject. Scrolls horizontally on phones, sticky name column. */
export default async function SheetPage({ params }: { params: Promise<{ csId: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const { csId } = await params;
  const s = await subjectResultSheet(ctx, csId).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });
  return (
    <>
      <PageHeader title={`${s.subjectName} result sheet`} subtitle={`${s.className} · ${s.tests.length} published tests`} back={`/results?classId=${s.classId}`} />
      {s.tests.length === 0 ? (
        <EmptyState icon={SheetIcon} title="No published tests yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2 text-xs text-muted">
                  <th className="sticky start-0 z-10 bg-surface-2 px-3 py-2.5 text-start font-semibold">Student</th>
                  {s.tests.map((t) => (
                    <th key={t.id} className="min-w-20 px-2 py-2.5 text-end font-semibold">
                      <span className="block max-w-28 truncate text-fg">{t.title}</span>
                      <span className="font-normal">{formatDate(t.date).slice(0, 6)} · /{fmtMark(t.totalMarks)}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-end font-semibold">Avg</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {s.students.map((st) => (
                  <tr key={st.id} className="border-t border-border">
                    <td className="sticky start-0 z-10 bg-surface px-3 py-2">
                      <span className="me-2 text-muted">{st.rollNo}</span>
                      <span className="font-medium">{st.name}</span>
                    </td>
                    {st.cells.map((c, i) => (
                      <td key={i} className="px-2 py-2 text-end">
                        {c == null ? <span className="text-subtle">—</span> : c.absent ? <span className="text-muted">A</span> : fmtMark(c.value!)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-end font-semibold">{formatPercent(st.average)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
