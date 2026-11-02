import Link from "next/link";
import { Avatar } from "@/components/ui/data";
import { cn } from "@/lib/cn";

export type Child = { id: string; name: string; className: string | null; readOnly?: boolean };

/** Parent child switcher (PRD §4.2) — chips that keep the current page. */
export function ChildSwitcher({ kids, active, basePath }: { kids: Child[]; active: string; basePath: string }) {
  if (kids.length < 2) return null;
  return (
    <nav className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Choose child">
      {kids.map((k) => {
        const on = k.id === active;
        return (
          <Link
            key={k.id}
            href={`${basePath}${basePath.includes("?") ? "&" : "?"}student=${k.id}`}
            replace
            scroll={false}
            aria-current={on ? "true" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border py-1 pe-4 ps-1 text-sm font-medium transition-colors",
              on ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            <Avatar name={k.name} size="sm" />
            {k.name.split(" ")[0]}
          </Link>
        );
      })}
    </nav>
  );
}
