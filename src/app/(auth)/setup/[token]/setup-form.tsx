"use client";

import { Check, Eye, EyeOff, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";

export function SetupForm({ token, phone }: { token: string; phone: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const longEnough = password.length >= 8;
  const matches = password.length > 0 && password === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!longEnough) return setError("Use at least 8 characters");
    if (!matches) return setError("Passwords don't match");
    setBusy(true);
    setError(null);
    try {
      await api("/auth/setup", { body: { token, password } });
      router.replace("/home?welcome=1");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
      {/* Lets password managers save the pair against the phone number */}
      <input type="hidden" name="username" autoComplete="username" value={phone} readOnly />
      {error && (
        <Notice tone="danger" icon={TriangleAlert}>
          {error}
        </Notice>
      )}
      <Field label="New password">
        {(p) => (
          <div className="relative">
            <Input
              {...p}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pe-12"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute end-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:text-fg"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        )}
      </Field>
      <Field label="Confirm password">
        {(p) => (
          <Input {...p} type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        )}
      </Field>
      <ul className="space-y-1.5 text-sm" aria-live="polite">
        <Rule ok={longEnough}>At least 8 characters</Rule>
        <Rule ok={matches}>Both passwords match</Rule>
      </ul>
      <Button type="submit" size="lg" block loading={busy} disabled={!longEnough || !matches}>
        Save password & continue
      </Button>
    </form>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-2", ok ? "text-success-fg" : "text-muted")}>
      <span className={cn("flex size-5 items-center justify-center rounded-full", ok ? "bg-success-soft" : "bg-surface-3")}>
        <Check className={cn("size-3.5", !ok && "opacity-0")} aria-hidden />
      </span>
      {children}
    </li>
  );
}
