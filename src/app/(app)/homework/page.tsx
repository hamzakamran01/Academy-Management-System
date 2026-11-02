import { CalendarClock, NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import { ChildSwitcher } from "@/components/child-switcher";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { addDays, todayPkt, weekStart } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { uuidOrUndefined } from "@/lib/validation";
import { requireCtx } from "@/server/auth/session";
import { parentProgress } from "@/server/modules/progress";
import { myChildren } from "@/server/modules/students";

export const metadata: Metadata = { title: "Homework" };

/** P-05: homework due today / this week. */
export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const ctx = await requireCtx(["parent"]);
  const sp = await searchParams;
  const kids = await myChildren(ctx);
  if (!kids.length) return <EmptyState icon={NotebookPen} title="No children linked" />;
  const child = kids.find((k) => k.id === uuidOrUndefined(sp.student)) ?? kids[0]!;
  const data = await parentProgress(ctx, child.id);
  const today = todayPkt();
  const endOfWeek = addDays(weekStart(today), 6);
  const all = data.subjects.flatMap((s) => s.homework.map((h) => ({ ...h, subjectName: s.subjectName }))).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const groups = [
    { label: "Due today", items: all.filter((h) => h.dueDate <= today) },
    { label: "This week", items: all.filter((h) => h.dueDate > today && h.dueDate <= endOfWeek) },
    { label: "Later", items: all.filter((h) => h.dueDate > endOfWeek) },
  ].filter((g) => g.items.length);

  return (
    <>
      <PageHeader title="Homework" subtitle={child.name} back="/more" />
      <ChildSwitcher kids={kids} active={child.id} basePath="/homework" />
      {groups.length === 0 ? (
        <EmptyState icon={NotebookPen} title="No homework right now" description="New homework from teachers appears here and you'll get a notification." />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.label}>
              <SectionTitle>{g.label}</SectionTitle>
              <ul className="space-y-2">
                {g.items.map((h) => (
                  <li key={h.id}>
                    <Card className="flex items-start gap-3 p-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info-fg">
                        <NotebookPen className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{h.subjectName}</p>
                        <p className="font-semibold">{h.title}</p>
                        {h.details && <p className="mt-0.5 text-sm text-muted">{h.details}</p>}
                      </div>
                      <Badge tone={h.dueDate <= today ? "warning" : "info"} icon={CalendarClock}>
                        {h.dueDate === today ? "Today" : formatDate(h.dueDate).slice(0, 6)}
                      </Badge>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
