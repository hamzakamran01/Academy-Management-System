"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { passwordRules } from "@/lib/password";

/** Live checklist that ticks as the password meets each rule. */
export function PasswordChecklist({ password, strong = false, phone, extra = [] }: { password: string; strong?: boolean; phone?: string; extra?: { label: string; ok: boolean }[] }) {
  const items = [...passwordRules({ strong, phone }).map((r) => ({ label: r.label, ok: r.ok(password) })), ...extra];
  return (
    <ul className="space-y-1.5 text-sm" aria-live="polite">
      {items.map((r) => (
        <li key={r.label} className={cn("flex items-center gap-2 transition-colors", r.ok ? "text-success-fg" : "text-muted")}>
          <span className={cn("flex size-5 items-center justify-center rounded-full transition-[background-color,transform]", r.ok ? "scale-100 bg-success-soft" : "bg-surface-3")}>
            <Check className={cn("size-3.5 transition-opacity", !r.ok && "opacity-0")} aria-hidden />
          </span>
          {r.label}
        </li>
      ))}
    </ul>
  );
}

export const passwordOk = (password: string, strong: boolean, phone?: string) => passwordRules({ strong, phone }).every((r) => r.ok(password));
