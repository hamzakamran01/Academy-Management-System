import { AlertOctagon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden />;
}

/** Generic list skeleton for loading.tsx files (UX-05). */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-fg">
        <Icon className="size-7" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "Check your connection and try again.",
  action,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center" role="alert">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger-fg">
        <AlertOctagon className="size-7" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "info",
  icon: Icon,
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-info-soft text-info-fg",
    warning: "bg-warning-soft text-warning-fg",
    danger: "bg-danger-soft text-danger-fg",
    success: "bg-success-soft text-success-fg",
  };
  return (
    <div className={cn("flex gap-3 rounded-xl p-3.5 text-sm", tones[tone], className)} role={tone === "danger" ? "alert" : "status"}>
      {Icon && <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />}
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-5 opacity-95">{children}</div>}
      </div>
    </div>
  );
}
