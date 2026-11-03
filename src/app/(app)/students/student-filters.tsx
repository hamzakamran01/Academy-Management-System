"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SearchInput } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/** Debounced search that writes `q` to the URL (keeps other params, resets the page). */
function useUrlSearch() {
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
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
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

  return { q, setQ, pending, update, params };
}

/** First screen: one search box across every class. */
export function StudentSearch({ placeholder }: { placeholder: string }) {
  const { q, setQ, pending } = useUrlSearch();
  return (
    <div className={cn("mb-4 transition-opacity", pending && "opacity-70")}>
      <SearchInput placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
    </div>
  );
}

/** Inside a class: search within it, plus Active / Removed and Fee unpaid for the office. */
export function StudentFilters({ showStatus, showFee, inClass }: { showStatus: boolean; showFee: boolean; inClass: boolean }) {
  const { q, setQ, pending, update, params } = useUrlSearch();
  const status = params.get("status") ?? "active";
  const fee = params.get("feeStatus") ?? "";

  return (
    <div className={cn("mb-4 space-y-3 transition-opacity", pending && "opacity-70")}>
      <SearchInput
        placeholder={inClass ? "Search in this class" : "Search name, roll no. or phone"}
        // Coming from the first screen's search: keep typing without re-tapping.
        autoFocus={!inClass && !!q}
        onFocus={(e) => {
          const n = e.currentTarget.value.length;
          e.currentTarget.setSelectionRange(n, n);
        }}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search students"
      />
      {(showStatus || showFee) && (
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {showStatus &&
            (["active", "removed"] as const).map((s) => (
              <FilterChip key={s} on={status === s} onClick={() => update({ status: s === "active" ? null : s })}>
                {s === "active" ? "Active" : "Removed"}
              </FilterChip>
            ))}
          {showFee && (
            <FilterChip on={fee === "unpaid"} onClick={() => update({ feeStatus: fee === "unpaid" ? null : "unpaid" })}>
              Fee unpaid
            </FilterChip>
          )}
        </div>
      )}
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
        "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium transition-[background-color,transform] active:scale-95",
        on ? "border-fg bg-fg text-bg" : "border-border bg-surface text-fg hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
