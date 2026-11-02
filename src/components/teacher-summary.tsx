import { CalendarCheck, ClipboardCheck, GraduationCap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";

export type Summary = { subjects: number; workingDays: number; avgDifference: number | null; logDaysPct: number | null; plansOnTimePct: number | null; testsOnTimePct: number | null };

const tone = (v: number | null, good: number, ok: number) => (v == null ? "text-muted" : v >= good ? "text-success-fg" : v >= ok ? "text-warning-fg" : "text-danger-fg");

/** FR-TPR-12: separate numbers, no combined score. */
export function TeacherSummaryGrid({ s, compact = false }: { s: Summary; compact?: boolean }) {
  const items = [
    { icon: TrendingUp, label: "vs expected", value: s.avgDifference == null ? "—" : `${s.avgDifference > 0 ? "+" : ""}${formatPercent(s.avgDifference)}`, cls: s.avgDifference == null ? "text-muted" : s.avgDifference >= -5 ? "text-success-fg" : s.avgDifference >= -15 ? "text-warning-fg" : "text-danger-fg" },
    { icon: CalendarCheck, label: "lesson-log days", value: formatPercent(s.logDaysPct, 0), cls: tone(s.logDaysPct, 90, 70) },
    { icon: ClipboardCheck, label: "plans on time", value: formatPercent(s.plansOnTimePct, 0), cls: tone(s.plansOnTimePct, 90, 60) },
    { icon: GraduationCap, label: "tests published ≤ 3 days", value: formatPercent(s.testsOnTimePct, 0), cls: tone(s.testsOnTimePct, 90, 60) },
  ];
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
      {items.map(({ icon: Icon, label, value, cls }) => (
        <div key={label} className="rounded-xl bg-surface-2 p-3">
          <p className={cn("tabular text-lg font-bold", cls)}>{value}</p>
          <p className="flex items-center gap-1 text-xs text-muted">
            <Icon className="size-3.5" aria-hidden /> {label}
          </p>
        </div>
      ))}
    </div>
  );
}
