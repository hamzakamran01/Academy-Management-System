"use client";

import { Eye, EyeOff, LogIn, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { api, ApiClientError } from "@/lib/api";

export function LoginForm({ expired }: { expired: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api("/auth/login", { body: { phone, password } });
      router.replace("/home");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFields(err.fields);
        if (!Object.keys(err.fields).length) setError(err.message);
      } else setError("Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
      {expired && !error && <Notice tone="info">Your session ended. Please sign in again.</Notice>}
      {error && (
        <Notice tone="danger" icon={TriangleAlert}>
          {error}
        </Notice>
      )}
      <Field label="Mobile number" error={fields.phone}>
        {(p) => (
          <Input
            {...p}
            type="tel"
            inputMode="tel"
            autoComplete="username"
            placeholder="0300 1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoFocus
          />
        )}
      </Field>
      <Field label="Password" error={fields.password}>
        {(p) => (
          <div className="relative">
            <Input
              {...p}
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pe-12"
              required
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
      <Button type="submit" size="lg" block loading={busy}>
        {!busy && <LogIn aria-hidden />}
        Sign in
      </Button>
      <p className="text-center text-sm text-muted">
        Forgot your password? Ask the academy office for a new setup link.
      </p>
    </form>
  );
}
