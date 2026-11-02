"use client";

import { ChevronDown, Search } from "lucide-react";
import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-lg border border-border bg-surface px-3.5 text-[16px] text-fg shadow-xs transition-[border-color,box-shadow] placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

// 16px font on inputs prevents iOS zoom-on-focus.
export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "h-12", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(control, "min-h-24 py-3 leading-6", className)} {...props} />;
});

/** Native select — the best picker on phones (full-screen OS wheel). */
export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-12 appearance-none pe-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-subtle" aria-hidden />
    </div>
  );
});

export function SearchInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-subtle" aria-hidden />
      <input type="search" className={cn(control, "h-11 ps-11")} {...props} />
    </div>
  );
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({
  label,
  hint,
  error,
  required,
  optional,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-sm font-medium text-fg">
        {label}
        {required && <span className="text-danger" aria-hidden>*</span>}
        {optional && <span className="text-xs font-normal text-subtle">Optional</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": error || hint ? descId : undefined })}
      {(error || hint) && (
        <p id={descId} className={cn("text-[13px]", error ? "font-medium text-danger-fg" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
