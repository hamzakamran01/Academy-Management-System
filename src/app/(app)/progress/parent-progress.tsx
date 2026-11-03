import { BookOpen } from "lucide-react";
import { ChildSwitcher } from "@/components/child-switcher";
import { PageHeader } from "@/components/shell/page-header";
import { LogBody } from "@/components/teaching-log";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { todayPkt } from "@/lib/dates";
import { formatDateShort } from "@/lib/format";
import type { Ctx } from "@/server/auth/session";
import { myChildren } from "@/server/modules/students";
import { parentClassLog } from "@/server/modules/teaching";

/** Parent: what was taught in each subject over the last week, with homework. */
export async function ParentProgress({ ctx, studentId }: { ctx: Ctx; studentId?: string }) {
  const kids = await myChildren(ctx);
  if (!kids.length) return <EmptyState icon={BookOpen} title="No children linked" />;
  const child = kids.find((k) => k.id === studentId) ?? kids[0]!;
  const data = await parentClassLog(ctx, child.id, 7);
  const today = todayPkt();

  return (
    <>
      <PageHeader title="In class" subtitle={`What ${child.name.split(" ")[0]} was taught this week`} bell />
      <ChildSwitcher kids={kids} active={child.id} basePath="/progress" />
      {data.subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects yet" />
      ) : (
        <ul className="stagger space-y-3">
          {data.subjects.map((s) => (
            <li key={s.classSubjectId}>
              <Card className="p-4">
                <div className="mb-3 min-w-0">
                  <p className="truncate text-base font-semibold">{s.subjectName}</p>
                  {s.teacherName && <p className="truncate text-[13px] text-muted">{s.teacherName}</p>}
                </div>
                {s.entries.length ? (
                  <ol className="space-y-3">
                    {s.entries.map((e) => (
                      <li key={e.id} className="flex gap-3">
                        <span className="w-14 shrink-0 pt-0.5 text-xs font-semibold text-muted">{e.date === today ? "Today" : formatDateShort(e.date).split(", ")[1]}</span>
                        <LogBody log={e} className="flex-1" />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted">No class logs this week yet.</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
