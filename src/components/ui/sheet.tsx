"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Bottom sheet on phones (thumb-reachable), centred dialog on desktop.
 * Used for forms, confirmations and pickers.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-raised outline-none data-[state=open]:animate-slide-up",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            size === "sm" && "sm:max-w-sm",
            size === "md" && "sm:max-w-lg",
            size === "lg" && "sm:max-w-2xl",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border-strong sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold leading-7">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-me-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
              aria-label="Close"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2">{children}</div>}
          {footer && (
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
