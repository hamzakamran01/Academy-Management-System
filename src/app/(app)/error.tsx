"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      description="We couldn't load this screen. Check your connection and try again."
      action={
        <Button onClick={reset} variant="secondary">
          <RotateCcw aria-hidden /> Retry
        </Button>
      }
    />
  );
}
