"use client";

import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { PasswordChecklist, passwordOk } from "@/components/password-rules";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api";

export function SetupForm({ token, phone, strong = false }: { token: string; phone: string; strong?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rulesOk = passwordOk(password, strong, phone);
  const matches = password.length > 0 && password === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rulesOk) return setError(strong ? "Your password doesn't meet all the rules yet" : "Use at least 8 characters");
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
      <PasswordChecklist password={password} strong={strong} phone={phone} extra={[{ label: "Both passwords match", ok: matches }]} />
      <Button type="submit" size="lg" block loading={busy} disabled={!rulesOk || !matches}>
        Save password & continue
      </Button>
    </form>
  );
}
