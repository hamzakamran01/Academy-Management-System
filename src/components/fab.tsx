import type { LucideIcon } from "lucide-react";
import Link from "next/link";

/**
 * Floating primary action on phones (UX-02: main action within thumb reach),
 * sitting just above the bottom navigation. Hidden on desktop, where the
 * header button is used instead.
 */
export function Fab({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return (
    <Link
      href={href}
      className="fixed bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+16px)] end-4 z-30 inline-flex h-14 items-center gap-2 rounded-2xl bg-primary px-5 text-[15px] font-semibold text-primary-fg shadow-raised transition-transform active:scale-95 lg:hidden"
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );
}
