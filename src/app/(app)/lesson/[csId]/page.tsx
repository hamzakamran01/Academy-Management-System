import { CircleSlash, History, NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { SectionTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { addDays, isValidISODate, todayPkt } from "@/lib/dates";
import { formatDate, formatDateShort } from "@/lib/format";
import { requireCtx } from "@/server/auth/session";
import { ApiError } from "@/server/http";
import { getDailyLog, noClassLabel } from "@/server/modules/teaching";
import { LessonForm } from "./lesson-form";

export const metadata: Metadata = { title: "Daily log" };

/** Write (or fix) the daily log for one class-subject. */
export default async function LessonPage({ params, searchParams }: { params: Promise<{ csId: string }>; searchParams: Promise<{ date?: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin", "teacher"]);
  const [{ csId }, sp] = await Promise.all([params, searchParams]);
  const today = todayPkt();
  const date = sp.date && isValidISODate(sp.date) && sp.date <= today ? sp.date : today;
  const data = await getDailyLog(ctx, csId, date).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });
  const days = [0, 1, 2].map((n) => addDays(today, -n));
  const doneHref = ctx.role === "teacher" ? "/home" : `/progress/${csId}`;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`${data.info.subjectName} · ${data.info.className}`} subtitle="Daily log" back={doneHref} />
      <nav className="mb-4 grid grid-cols-3 gap-2" aria-label="Day">
        {days.map((d, i) => (
          <Link
            key={d}
            href={`/lesson/${csId}${i ? `?date=${d}` : ""}`}
            replace
            scroll={false}
            aria-current={d === date ? "date" : undefined}
            className={cn(
              "flex h-14 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition-[background-color,transform] active:scale-[0.97]",
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
        isToday={date === today}
        canEdit={data.canEdit}
        doneHref={doneHref}
        initial={data.log ? { taught: data.log.taught, homework: data.log.homework, noClassReason: data.log.noClassReason } : null}
      />

      {data.recent.length > 0 && (
        <section className="mt-8">
          <SectionTitle>
            <span className="inline-flex items-center gap-1.5">
              <History className="size-3.5" aria-hidden /> Earlier logs
            </span>
          </SectionTitle>
          <ol className="relative space-y-3 border-s border-border ps-5">
            {data.recent.map((l) => (
              <li key={l.id} className="relative">
                <span className="absolute -start-[25px] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-bg" aria-hidden />
                <p className="text-xs font-semibold text-muted">{formatDate(l.date)}</p>
                {l.noClassReason ? (
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted">
                    <CircleSlash className="size-3.5" aria-hidden /> No class · {noClassLabel(l.noClassReason)}
                  </p>
                ) : (
                  <p className="mt-0.5 whitespace-pre-line text-[15px] leading-6 [overflow-wrap:anywhere]">{l.taught}</p>
                )}
                {l.homework && (
                  <p className="mt-1 inline-flex items-start gap-1.5 text-sm text-success-fg">
                    <NotebookPen className="mt-0.5 size-3.5 shrink-0" aria-hidden /> <span className="[overflow-wrap:anywhere]">{l.homework}</span>
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
