"use client";

import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatMonth } from "@/lib/format";
import { useMutation } from "@/lib/use-mutation";

/** FR-FEE-04 manual "Create this month's fee list" — safe to press twice. */
export function GenerateButton({ month, variant = "primary" }: { month: string; variant?: "primary" | "secondary" }) {
  const { run, busy } = useMutation();
  return (
    <Button
      variant={variant}
      loading={busy}
      onClick={() =>
        run(async () => {
          const r = await api<{ created: number; total: number }>("/fees/generate", { body: { month } });
          return r;
        }, { success: `${formatMonth(month)} fee list is ready` })
      }
    >
      <ListPlus aria-hidden /> Create {formatMonth(month, true)} fee list
    </Button>
  );
}
