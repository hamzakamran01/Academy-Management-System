import { cn } from "@/lib/cn";
import { ACADEMY_FULL_NAME, APP_NAME } from "@/lib/brand";
import { LogoMark } from "./logo-mark";

export { LogoMark };

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <LogoMark className="shrink-0" />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[17px] font-bold tracking-tight">{APP_NAME}</p>
        <p className="max-w-44 truncate text-xs text-muted">{subtitle ?? ACADEMY_FULL_NAME}</p>
      </div>
    </div>
  );
}

/**
 * Welcome screen shown for ~2.4 s when the app is opened (once per tab
 * session). Server-rendered and timed in CSS so it appears instantly and
 * leaves on its own even before JavaScript loads; an inline script skips it
 * on later page loads in the same session.
 */
export function Splash() {
  return (
    <>
      <div id="kms-splash" className="splash fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden px-8 text-center" aria-hidden>
        <div className="splash-glow" />
        <LogoMark animated className="relative size-28 drop-shadow-[0_18px_40px_rgba(38,38,127,0.35)]" />
        <p className="splash-title relative mt-7 text-[22px] font-bold leading-tight tracking-tight text-fg sm:text-[26px]">
          Kamran Maths <span className="font-semibold text-primary">and</span> Science Academy
        </p>
        <p className="splash-sub relative mt-2 text-[13px] font-medium uppercase tracking-[0.22em] text-muted">{APP_NAME}</p>
        <div className="splash-bar relative mt-8 h-1 w-28 overflow-hidden rounded-full bg-surface-3">
          <span className="block h-full w-full origin-left rounded-full bg-primary" />
        </div>
      </div>
      <script
        // Runs before paint: show the welcome screen only on the first load of this tab.
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem("kms_splash")){document.documentElement.classList.add("no-splash")}else{sessionStorage.setItem("kms_splash","1")}}catch(e){}`,
        }}
      />
    </>
  );
}
