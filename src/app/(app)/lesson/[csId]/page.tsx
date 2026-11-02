import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { addDays, isValidISODate, todayPkt } from "@/lib/dates";
import { formatDateShort } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { getLessonLog } from "@/server/modules/progress";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { LessonForm } from "./lesson-form";

export const metadata: Metadata = { title: "Log lesson" };

/** T-04: lesson log + homework (two-tap pattern). */
export default async function LessonPage({ params, searchParams }: { params: Promise<{ csId: string }>; searchParams: Promise<{ date?: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const [{ csId }, sp] = await Promise.all([params, searchParams]);
  const today = todayPkt();
  const date = sp.date && isValidISODate(sp.date) && sp.date <= today ? sp.date : today;
  const data = await getLessonLog(ctx, csId, date).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });
  const days = [0, 1, 2].map((n) => addDays(today, -n));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Log lesson" subtitle={`${data.info.subjectName} · ${data.info.className}`} back={`/progress/${csId}`} />
      <nav className="mb-4 grid grid-cols-3 gap-2" aria-label="Lesson date">
        {days.map((d, i) => (
          <Link
            key={d}
            href={`/lesson/${csId}${i ? `?date=${d}` : ""}`}
            replace
            aria-current={d === date ? "date" : undefined}
            className={cn(
              "flex h-12 flex-col items-center justify-center rounded-xl border text-sm font-semibold",
              d === date ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            {i === 0 ? "Today" : i === 1 ? "Yesterday" : formatDateShort(d).split(",")[0]}
            <span className="text-[11px] font-normal opacity-80">{formatDateShort(d).split(", ")[1]}</span>
          </Link>
        ))}
      </nav>
      <LessonForm
        key={date}
        csId={csId}
        date={date}
        canEdit={data.canEdit}
        suggestions={data.suggestions}
        plannedIds={data.plannedIds}
        tree={data.tree}
        initial={data.log ? { topics: data.log.topics.map((t) => ({ topicId: t.topicId, status: t.status, pages: t.pages })), noLessonReason: data.log.noLessonReason, note: data.log.note } : null}
      />
    </div>
  );
}
