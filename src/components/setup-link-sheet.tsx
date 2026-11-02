"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { APP_NAME } from "@/lib/brand";

export type SetupLinkInfo = { name: string; phone: string; setupLink: string | null; created?: boolean };

/**
 * Shown after creating an account (FR-AUTH-02). The creator copies the link
 * or opens their own WhatsApp with a pre-written message — no paid API.
 */
export function SetupLinkSheet({
  info,
  academyName,
  onClose,
}: {
  info: SetupLinkInfo | null;
  academyName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!info) return null;
  const firstName = info.name.split(" ")[0];
  const message = info.setupLink
    ? `Assalam-o-Alaikum ${firstName}! Your ${academyName} account on ${APP_NAME} is ready.\n\nTap this link to set your password (valid for 7 days):\n${info.setupLink}\n\nThen sign in with your mobile number ${formatPhone(info.phone)}.`
    : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(info!.setupLink!);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — long-press the link to copy it");
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={info.setupLink ? "Share the setup link" : "Account ready"}
      description={
        info.setupLink
          ? `${info.name} uses this link once to set a password. It expires in 7 days.`
          : `${info.name} already has a password and can sign in with ${formatPhone(info.phone)}.`
      }
      footer={
        info.setupLink ? (
          <>
            <Button variant="secondary" onClick={copy}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy link"}
            </Button>
            <a
              href={whatsappLink(info.phone, message)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1fa855] px-4 text-[15px] font-semibold text-white shadow-xs hover:brightness-95"
            >
              <MessageCircle className="size-[18px]" aria-hidden /> Share on WhatsApp
            </a>
          </>
        ) : (
          <Button onClick={onClose}>Done</Button>
        )
      }
    >
      {info.setupLink && (
        <div className="space-y-3">
          <div className="break-all rounded-lg border border-dashed border-border-strong bg-surface-2 p-3 font-mono text-[13px] leading-5 text-muted select-all">
            {info.setupLink}
          </div>
          <Notice tone="info">Only share this with {firstName}. Anyone with the link can set the password.</Notice>
        </div>
      )}
    </Sheet>
  );
}
