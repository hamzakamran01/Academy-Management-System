"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SearchInput, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/** URL-driven filters (shareable, survive refresh). Search is debounced. */
export function StudentFilters({ classes, showStatus }: { classes: { id: string; name: string }[]; showStatus: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();
  const first = useRef(true);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const status = params.get("status") ?? "active";
  const fee = params.get("feeStatus") ?? "";

  return (
    <div className={cn("mb-4 space-y-3 transition-opacity", pending && "opacity-70")}>
      <SearchInput placeholder="Search name, roll no. or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Select
          aria-label="Class"
          className="h-10 w-auto min-w-36 text-sm"
          value={params.get("classId") ?? ""}
          onChange={(e) => update({ classId: e.target.value || null })}
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        {showStatus &&
          (["active", "removed", "all"] as const).map((s) => (
            <FilterChip key={s} on={status === s} onClick={() => update({ status: s === "active" ? null : s })}>
              {s === "active" ? "Active" : s === "removed" ? "Removed" : "All"}
            </FilterChip>
          ))}
        <FilterChip on={fee === "unpaid"} onClick={() => update({ feeStatus: fee === "unpaid" ? null : "unpaid" })}>
          Fee unpaid
        </FilterChip>
      </div>
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors",
        on ? "border-fg bg-fg text-bg" : "border-border bg-surface text-fg hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
