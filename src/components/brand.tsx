import { cn } from "@/lib/cn";

/** Campusly mark — an open book forming a rising "C" arc. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <defs>
        <linearGradient id="cl-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.58 0.2 268)" />
          <stop offset="1" stopColor="oklch(0.45 0.21 285)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#cl-g)" />
      <path d="M27.5 13.2A9.5 9.5 0 1 0 27.5 26.8" fill="none" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M15.5 20.5l3 3 6-6.5" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.92" />
    </svg>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-tight">
        <p className="text-[17px] font-bold tracking-tight">Campusly</p>
        {subtitle && <p className="max-w-40 truncate text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
