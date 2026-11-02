"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { THEME_COOKIE } from "@/lib/theme";

type Theme = "light" | "dark";

function apply(theme: Theme) {
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#13151f" : "#f8f9fc");
}

/** Light (default) / Dark switch. Saved per device in a cookie so the server renders it without a flash. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"), []);
  const choose = (t: Theme) => {
    setTheme(t);
    apply(t);
  };
  return (
    <div role="radiogroup" aria-label="Appearance" className={cn("grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1", className)}>
      {(["light", "dark"] as const).map((t) => {
        const on = theme === t;
        const Icon = t === "light" ? Sun : Moon;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => choose(t)}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
              on ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t === "light" ? "Light" : "Dark"}
          </button>
        );
      })}
    </div>
  );
}
