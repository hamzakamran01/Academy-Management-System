import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Page numbers to show: always first, last and the neighbours of the current page. */
function pageList(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => keep.add(p));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((p) => keep.add(p));
  const sorted = [...keep].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1]! > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/**
 * Numbered, link-based pagination (works without JS, keeps the URL shareable).
 * `href(n)` builds the link for page n.
 */
export function Pagination({
  page,
  pageSize,
  total,
  href,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  href: (page: number) => string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const cell =
    "inline-flex size-10 items-center justify-center rounded-lg text-sm font-semibold tabular transition-[background-color,transform] active:scale-95";
  return (
    <nav className={cn("mt-4 flex flex-col items-center gap-2.5", className)} aria-label="Pages">
      {pages > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            {page > 1 ? (
              <Link href={href(page - 1)} scroll={false} className={cn(cell, "text-fg hover:bg-surface-2")} aria-label="Previous page">
                <ChevronLeft className="size-5" />
              </Link>
            ) : (
              <span className={cn(cell, "text-subtle/50")} aria-hidden>
                <ChevronLeft className="size-5" />
              </span>
            )}
          </li>
          {pageList(page, pages).map((p, i) =>
            p === "gap" ? (
              <li key={`g${i}`} className="w-6 text-center text-subtle" aria-hidden>
                …
              </li>
            ) : (
              <li key={p}>
                <Link
                  href={href(p)}
                  scroll={false}
                  aria-current={p === page ? "page" : undefined}
                  className={cn(cell, p === page ? "bg-primary text-primary-fg shadow-xs" : "text-fg hover:bg-surface-2")}
                >
                  {p}
                </Link>
              </li>
            ),
          )}
          <li>
            {page < pages ? (
              <Link href={href(page + 1)} scroll={false} className={cn(cell, "text-fg hover:bg-surface-2")} aria-label="Next page">
                <ChevronRight className="size-5" />
              </Link>
            ) : (
              <span className={cn(cell, "text-subtle/50")} aria-hidden>
                <ChevronRight className="size-5" />
              </span>
            )}
          </li>
        </ul>
      )}
      <p className="text-[13px] text-muted">
        Showing <span className="tabular font-semibold text-fg">{from}–{to}</span> of <span className="tabular font-semibold text-fg">{total}</span>
      </p>
    </nav>
  );
}
