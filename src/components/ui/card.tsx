import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-border bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pt-4 pb-2", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-6">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

/** A tappable card that links somewhere — shows a chevron and a pressed state. */
export function CardLink({
  href,
  className,
  children,
  chevron = true,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  chevron?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2 active:bg-surface-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {chevron && <ChevronRight className="size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </Link>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-1 pb-2 pt-1", className)}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}
