import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Hourglass,
  Info,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        success: "bg-success-soft text-success-fg",
        warning: "bg-warning-soft text-warning-fg",
        danger: "bg-danger-soft text-danger-fg",
        info: "bg-info-soft text-info-fg",
        primary: "bg-primary-soft text-primary-soft-fg",
        neutral: "bg-neutral-soft text-neutral-fg",
      },
      size: {
        sm: "h-6 px-2 text-xs [&_svg]:size-3.5",
        md: "h-7 px-2.5 text-[13px] [&_svg]:size-4",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

export type Tone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  size,
  icon: Icon,
  children,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { icon?: LucideIcon }) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {Icon && <Icon aria-hidden />}
      {children}
    </span>
  );
}

/**
 * Every status is text + colour + icon — never colour alone (UX-04).
 * One map so "Paid" looks identical on every screen.
 */
const STATUS: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  // fees
  paid: { label: "Paid", tone: "success", icon: CheckCircle2 },
  unpaid: { label: "Unpaid", tone: "warning", icon: Hourglass },
  waived: { label: "Waived", tone: "neutral", icon: MinusCircle },
  // salaries
  pending: { label: "Pending", tone: "warning", icon: Hourglass },
  // attendance
  present: { label: "Present", tone: "success", icon: CheckCircle2 },
  absent: { label: "Absent", tone: "danger", icon: XCircle },
  late: { label: "Late", tone: "warning", icon: Clock },
  leave: { label: "Leave", tone: "info", icon: Info },
  unmarked: { label: "Not marked", tone: "neutral", icon: CircleDashed },
  // results
  draft: { label: "Draft", tone: "neutral", icon: CircleDashed },
  published: { label: "Published", tone: "success", icon: CheckCircle2 },
  unlocked: { label: "Unlocked", tone: "warning", icon: AlertTriangle },
  // progress
  on_track: { label: "On track", tone: "success", icon: CheckCircle2 },
  at_risk: { label: "At risk", tone: "warning", icon: AlertTriangle },
  behind: { label: "Behind", tone: "danger", icon: XCircle },
  no_targets: { label: "No targets", tone: "neutral", icon: CircleDashed },
  // plans
  submitted: { label: "Submitted", tone: "success", icon: CheckCircle2 },
  missing: { label: "Missing", tone: "danger", icon: XCircle },
  late_plan: { label: "Late", tone: "warning", icon: Clock },
  // people
  active: { label: "Active", tone: "success", icon: CheckCircle2 },
  removed: { label: "Removed", tone: "neutral", icon: MinusCircle },
  deactivated: { label: "Deactivated", tone: "neutral", icon: MinusCircle },
  invited: { label: "Invite sent", tone: "info", icon: Clock },
};

export function StatusBadge({
  status,
  label,
  size,
  className,
}: {
  status: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" as Tone, icon: CircleDashed };
  return (
    <Badge tone={s.tone} size={size} icon={s.icon} className={className}>
      {label ?? s.label}
    </Badge>
  );
}
