import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/** Dashboard KPI tile — label, big number, optional context line. */
export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "primary",
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
  href?: string;
  className?: string;
}) {
  const iconTone = {
    primary: "bg-primary-soft text-primary-soft-fg",
    success: "bg-success-soft text-success-fg",
    warning: "bg-warning-soft text-warning-fg",
    danger: "bg-danger-soft text-danger-fg",
    info: "bg-info-soft text-info-fg",
    neutral: "bg-neutral-soft text-neutral-fg",
  }[tone];
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-muted">{label}</p>
        {Icon && (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", iconTone)}>
            <Icon className="size-[18px]" aria-hidden />
          </span>
        )}
      </div>
      <p className="tabular mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
    </>
  );
  const cls = cn("block rounded-xl border border-border bg-surface p-4 shadow-card", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-surface-2 active:bg-surface-3")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function ProgressBar({
  value,
  marker,
  tone = "primary",
  size = "md",
  label,
  className,
}: {
  value: number;
  /** Optional expected-position marker (e.g. Expected %). */
  marker?: number | null;
  tone?: "primary" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-full bg-surface-3", size === "sm" ? "h-1.5" : "h-2.5", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${pct}%` }} />
      {marker != null && (
        <div
          className="absolute inset-y-0 w-0.5 bg-fg/60"
          style={{ left: `calc(${Math.max(0, Math.min(100, marker))}% - 1px)` }}
          aria-hidden
        />
      )}
    </div>
  );
}

const AVATAR_TONES = [
  "bg-primary-soft text-primary-soft-fg",
  "bg-success-soft text-success-fg",
  "bg-info-soft text-info-fg",
  "bg-warning-soft text-warning-fg",
  "bg-danger-soft text-danger-fg",
];

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        AVATAR_TONES[h % AVATAR_TONES.length],
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-14 text-lg",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Label/value list for detail screens. */
export function DescriptionList({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-border", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex items-start justify-between gap-4 py-3">
          <dt className="text-sm text-muted">{it.label}</dt>
          <dd className="text-end text-sm font-medium">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A row in a list card — avatar/icon, title, subtitle, trailing slot. */
export function ListRow({
  href,
  leading,
  title,
  subtitle,
  trailing,
  className,
}: {
  href?: string;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{title}</div>
        {subtitle && <div className="truncate text-[13px] text-muted">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </>
  );
  const cls = cn("flex min-h-16 items-center gap-3 px-4 py-3", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-surface-2 active:bg-surface-3")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card", className)}>
      {children}
    </div>
  );
}
