"use client";

import { BellRing, Download, MoreVertical, PlusSquare, Share, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function b64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** UX-11 / FR-NOT-03: install the PWA and turn on push. */
export function InstallCard() {
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [standalone, setStandalone] = useState(false);
  const [prompt, setPrompt] = useState<BIP | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "other");
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BIP);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone) {
    return (
      <Notice tone="success" icon={Smartphone} title="Campusly is installed">
        You're using the app from your home screen.
      </Notice>
    );
  }
  return (
    <Card>
      <CardHeader title="Add Campusly to your home screen" description="Opens like an app, loads faster and can receive notifications." />
      <CardBody className="space-y-4">
        {platform === "ios" ? (
          <ol className="space-y-3 text-sm">
            <Step n={1}>
              Open this page in <b>Safari</b>.
            </Step>
            <Step n={2}>
              Tap the <Share className="inline size-4 align-text-bottom" aria-label="Share" /> <b>Share</b> button at the bottom.
            </Step>
            <Step n={3}>
              Choose <PlusSquare className="inline size-4 align-text-bottom" aria-hidden /> <b>Add to Home Screen</b>, then <b>Add</b>.
            </Step>
            <Step n={4}>Open Campusly from your home screen and turn on notifications below.</Step>
          </ol>
        ) : prompt ? (
          <Button
            size="lg"
            block
            onClick={async () => {
              await prompt.prompt();
              await prompt.userChoice;
              setPrompt(null);
            }}
          >
            <Download aria-hidden /> Install Campusly
          </Button>
        ) : (
          <ol className="space-y-3 text-sm">
            <Step n={1}>
              In Chrome, tap the <MoreVertical className="inline size-4 align-text-bottom" aria-label="menu" /> menu.
            </Step>
            <Step n={2}>
              Tap <b>Install app</b> or <b>Add to Home screen</b>.
            </Step>
          </ol>
        )}
        {platform === "ios" && <p className="text-[13px] text-muted">On iPhone, notifications work only after adding to the Home Screen (iOS 16.4 or newer).</p>}
      </CardBody>
    </Card>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-fg">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

export function PushCard({ vapidKey, categories, initialMuted, initialSummary, isParent }: { vapidKey: string | null; categories: { key: string; label: string }[]; initialMuted: string[]; initialSummary: boolean; isParent: boolean }) {
  const [state, setState] = useState<"unknown" | "unsupported" | "denied" | "off" | "on">("unknown");
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState<string[]>(initialMuted);
  const [summary, setSummary] = useState(initialSummary);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  async function enable() {
    if (!vapidKey) return toast.error("Push isn't configured on the server yet");
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapidKey) });
      await api("/push/subscribe", { body: sub.toJSON() });
      setState("on");
      toast.success("Notifications are on");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function savePrefs(nextMuted: string[], nextSummary: boolean) {
    setMuted(nextMuted);
    setSummary(nextSummary);
    try {
      await api("/me/notification-preferences", { method: "PUT", body: { mutedPush: nextMuted, dailySummary: nextSummary } });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader
        title="Phone notifications"
        description="Lock-screen alerts never show marks, fees or salaries — open the app to see details."
        action={state === "on" ? <Badge tone="success">On</Badge> : state === "unknown" ? null : <Badge>Off</Badge>}
      />
      <CardBody className="space-y-4">
        {state === "unsupported" && <Notice tone="warning">This browser can't receive push notifications. On iPhone, add Campusly to your Home Screen first.</Notice>}
        {state === "denied" && <Notice tone="warning">Notifications are blocked. Allow them for this site in your browser settings, then come back.</Notice>}
        {(state === "off" || state === "on") && (
          <Button variant={state === "on" ? "secondary" : "primary"} block loading={busy} onClick={state === "on" ? disable : enable}>
            <BellRing aria-hidden /> {state === "on" ? "Turn off on this phone" : "Turn on notifications"}
          </Button>
        )}
        <div className="divide-y divide-border rounded-xl border border-border">
          {categories.map((c) => {
            const on = !muted.includes(c.key);
            return (
              <label key={c.key} className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4">
                <span className="text-sm font-medium">{c.label}</span>
                <Toggle on={on} onChange={(v) => savePrefs(v ? muted.filter((m) => m !== c.key) : [...muted, c.key], summary)} label={c.label} />
              </label>
            );
          })}
          {isParent && (
            <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4">
              <span className="text-sm">
                <span className="block font-medium">One daily summary at 7 pm</span>
                <span className="text-muted">Instead of separate alerts. Fee and urgent alerts still come right away.</span>
              </span>
              <Toggle on={summary} onChange={(v) => savePrefs(muted, v)} label="Daily summary" />
            </label>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-border-strong")}
    >
      <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow-xs transition-[inset-inline-start]", on ? "start-[22px]" : "start-0.5")} />
    </button>
  );
}
