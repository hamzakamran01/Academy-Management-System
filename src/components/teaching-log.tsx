import { CheckCircle2, CircleDashed, CircleSlash, NotebookPen } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";

type Reason = "test" | "revision" | "teacher_absent" | "event" | "other";
const REASON_LABEL: Record<Reason, string> = { test: "Test day", revision: "Revision", teacher_absent: "Teacher absent", event: "Holiday / event", other: "Other" };

export type LogView = { taught: string | null; homework: string | null; noClassReason: Reason | null };

/** What was taught (or why there was no class) and the homework, if any. */
export function LogBody({ log, clamp = false, className }: { log: LogView; clamp?: boolean; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      {log.noClassReason ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted">
          <CircleSlash className="size-4 shrink-0" aria-hidden /> No class · {REASON_LABEL[log.noClassReason]}
        </p>
      ) : (
        <p className={cn("whitespace-pre-line text-[15px] leading-6 [overflow-wrap:anywhere]", clamp && "line-clamp-3")}>{log.taught}</p>
      )}
      {log.homework && (
        <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-success-soft/60 px-2.5 py-1.5 text-[13px] leading-5 text-success-fg">
          <NotebookPen className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className={cn("[overflow-wrap:anywhere]", clamp && "line-clamp-2")}>
            <span className="font-semibold">Homework:</span> {log.homework}
          </span>
        </p>
      )}
    </div>
  );
}

/** Logged / not yet pill. */
export function LogPill({ logged, missed = false }: { logged: boolean; missed?: boolean }) {
  return logged ? (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 text-xs font-semibold text-success-fg">
      <CheckCircle2 className="size-3.5" aria-hidden /> Logged
    </span>
  ) : (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold", missed ? "bg-danger-soft text-danger-fg" : "bg-warning-soft text-warning-fg")}>
      <CircleDashed className="size-3.5" aria-hidden /> {missed ? "Missed" : "Not yet"}
    </span>
  );
}

/**
 * A row of day dots — green = all logged, amber = some, red = none.
 * `days` oldest → newest.
 */
export function DayStrip({ days, size = "md", showLabels = false }: { days: { date: string; state: "done" | "partial" | "missed" | "open" }[]; size?: "sm" | "md"; showLabels?: boolean }) {
  return (
    <ol className="flex items-end gap-1" aria-label="Days logged">
      {days.map((d) => {
        const label = formatDateShort(d.date);
        return (
          <li key={d.date} className="flex flex-col items-center gap-1" title={`${label}: ${d.state === "done" ? "logged" : d.state === "partial" ? "partly logged" : d.state === "open" ? "today" : "missed"}`}>
            <span
              className={cn(
                "block rounded-full",
                size === "sm" ? "h-2 w-3.5" : "h-2.5 w-5",
                d.state === "done" && "bg-success",
                d.state === "partial" && "bg-warning",
                d.state === "missed" && "bg-danger/70",
                d.state === "open" && "bg-surface-3 ring-1 ring-inset ring-border-strong",
              )}
            />
            {showLabels && <span className="text-[10px] font-medium leading-none text-subtle">{label.split(",")[0]!.slice(0, 2)}</span>}
            <span className="sr-only">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
