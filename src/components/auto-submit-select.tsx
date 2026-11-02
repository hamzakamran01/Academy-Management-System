"use client";

import type { ComponentProps } from "react";
import { Select } from "@/components/ui/field";

/** A filter select that applies immediately (submits its GET form) — no separate "Filter" button. */
export function AutoSubmitSelect(props: ComponentProps<typeof Select>) {
  return <Select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
