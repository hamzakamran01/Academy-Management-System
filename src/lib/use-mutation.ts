"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ApiClientError } from "./api";

/**
 * Wraps a write call: busy state, field errors, toast on failure,
 * and a router refresh so server components re-read fresh data.
 */
export function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts: { success?: string; refresh?: boolean } = {}): Promise<T | undefined> => {
      setBusy(true);
      setFields({});
      try {
        const out = await fn();
        if (opts.success) toast.success(opts.success);
        if (opts.refresh !== false) router.refresh();
        return out;
      } catch (err) {
        if (err instanceof ApiClientError && Object.keys(err.fields).length) setFields(err.fields);
        else toast.error(err instanceof Error ? err.message : "Something went wrong");
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  return { run, busy, fields, setFields };
}
