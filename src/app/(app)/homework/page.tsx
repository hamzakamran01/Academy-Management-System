import { CalendarClock, NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import { ChildSwitcher } from "@/components/child-switcher";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { todayPkt } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { uuidOrUndefined } from "@/lib/validation";
import { requireCtx } from "@/server/auth/session";
import { myChildren } from "@/server/modules/students";
import { homeworkForStudent } from "@/server/modules/teaching";

export const metadata: Metadata = { title: "Homework" };

/** Parent: homework teachers wrote in their daily logs. */
export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const ctx = await requireCtx(["parent"]);
  const sp = await searchParams;
  const kids = await myChildren(ctx);
  if (!kids.length) return <EmptyState icon={NotebookPen} title="No children linked" />;
  const child = kids.find((k) => k.id === uuidOrUndefined(sp.student)) ?? kids[0]!;
  const items = await homeworkForStudent(ctx, child.id);
  const today = todayPkt();
  const groups = [
    { label: "Coming up", items: items.filter((h) => h.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)) },
    { label: "Earlier", items: items.filter((h) => h.dueDate < today) },
  ].filter((g) => g.items.length);

  return (
    <>
      <PageHeader title="Homework" subtitle={child.name} back="/more" />
      <ChildSwitcher kids={kids} active={child.id} basePath="/homework" />
      {groups.length === 0 ? (
        <EmptyState icon={NotebookPen} title="No homework right now" description="Homework from teachers appears here, and you'll get a notification." />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.label}>
              <SectionTitle>{g.label}</SectionTitle>
              <ul className="stagger space-y-2">
                {g.items.map((h) => (
                  <li key={h.id}>
                    <Card className="flex items-start gap-3 p-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success-fg">
                        <NotebookPen className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{h.subjectName}</p>
                        <p className="mt-0.5 whitespace-pre-line text-[15px] leading-6 [overflow-wrap:anywhere]">{h.text}</p>
                        {h.givenOn && <p className="mt-1 text-xs text-subtle">Given {formatDate(h.givenOn)}</p>}
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
