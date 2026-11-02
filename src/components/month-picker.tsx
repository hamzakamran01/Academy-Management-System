"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import { formatMonth } from "@/lib/format";

/** Month stepper bound to ?month=YYYY-MM-01. `months` is newest-first. */
export function MonthPicker({ months, value, className }: { months: string[]; value: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const i = months.indexOf(value);
  const go = (m: string | undefined) => {
    if (!m) return;
    const next = new URLSearchParams(params.toString());
    next.set("month", m);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return (
    <div className={cn("inline-flex h-11 items-center rounded-lg border border-border bg-surface shadow-xs", pending && "opacity-70", className)}>
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center text-muted hover:text-fg disabled:opacity-30"
        onClick={() => go(months[i + 1])}
        disabled={i < 0 || i >= months.length - 1}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-5" />
      </button>
      <label className="relative">
        <span className="sr-only">Month</span>
        <select
          className="h-11 min-w-36 cursor-pointer appearance-none bg-transparent px-1 text-center text-[15px] font-semibold focus:outline-none"
          value={value}
          onChange={(e) => go(e.target.value)}
        >
          {months.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center text-muted hover:text-fg disabled:opacity-30"
        onClick={() => go(months[i - 1])}
        disabled={i <= 0}
        aria-label="Next month"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
