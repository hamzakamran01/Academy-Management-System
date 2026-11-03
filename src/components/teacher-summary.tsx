import { CalendarCheck, CalendarX2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";

export type Summary = { subjects: number; workingDays: number; logDaysPct: number | null; missedDays: number; testsOnTimePct: number | null; testsPublished: number };

const tone = (v: number | null, good: number, ok: number) => (v == null ? "text-muted" : v >= good ? "text-success-fg" : v >= ok ? "text-warning-fg" : "text-danger-fg");

/** Separate plain numbers, no combined score. */
export function TeacherSummaryGrid({ s, compact = false }: { s: Summary; compact?: boolean }) {
  const items = [
    { icon: CalendarCheck, label: "daily logs written", value: formatPercent(s.logDaysPct, 0), cls: tone(s.logDaysPct, 90, 70) },
    { icon: CalendarX2, label: `days with no log (of ${s.workingDays})`, value: String(s.missedDays), cls: s.missedDays === 0 ? "text-success-fg" : s.missedDays <= 2 ? "text-warning-fg" : "text-danger-fg" },
    { icon: GraduationCap, label: "tests published ≤ 3 days", value: formatPercent(s.testsOnTimePct, 0), cls: tone(s.testsOnTimePct, 90, 60) },
  ];
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
      {items.map(({ icon: Icon, label, value, cls }) => (
        <div key={label} className="min-w-0 rounded-xl bg-surface-2 p-3">
          <p className={cn("tabular text-lg font-bold", cls)}>{value}</p>
          <p className="flex items-start gap-1 text-xs leading-4 text-muted">
            <Icon className="mt-px size-3.5 shrink-0" aria-hidden /> <span className="min-w-0">{label}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
