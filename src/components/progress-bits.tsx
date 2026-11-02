import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/data";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";
import type { Progress } from "@/lib/progress";

export function statusTone(status: Progress["status"]): "success" | "warning" | "danger" | "primary" {
  return status === "on_track" ? "success" : status === "at_risk" ? "warning" : status === "behind" ? "danger" : "primary";
}

/** Coverage bar with the Expected position as a marker (FR-TPR-09). */
export function CoverageBar({ p, size = "md" }: { p: Progress; size?: "sm" | "md" }) {
  return (
    <div>
      <ProgressBar value={p.coverage ?? 0} marker={p.expected} tone={statusTone(p.status)} size={size} label="Syllabus covered" />
      <div className="mt-1.5 flex items-center justify-between text-[13px] text-muted">
        <span>
          <span className="tabular font-semibold text-fg">{formatPercent(p.coverage, 0)}</span> covered
        </span>
        {p.expected != null && (
          <span>
            expected <span className="tabular font-semibold text-fg">{formatPercent(p.expected, 0)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function ProgressStatus({ p }: { p: Progress }) {
  if (p.status === "no_syllabus") return <StatusBadge status="no_targets" label="No syllabus" />;
  return <StatusBadge status={p.status} />;
}

/** ✅ completed / ◐ in progress / ○ remaining (FR-TPR-09) — icon + text, never colour alone. */
export function TopicStatusIcon({ status, className }: { status: "not_started" | "started" | "completed"; className?: string }) {
  if (status === "completed") return <CheckCircle2 className={cn("size-5 text-success", className)} aria-label="Completed" />;
  if (status === "started") return <CircleDot className={cn("size-5 text-warning", className)} aria-label="In progress" />;
  return <Circle className={cn("size-5 text-subtle", className)} aria-label="Remaining" />;
}
