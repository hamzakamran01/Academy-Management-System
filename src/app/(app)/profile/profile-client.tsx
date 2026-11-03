"use client";

import { KeyRound, LogOut, MonitorSmartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PasswordChecklist, passwordOk } from "@/components/password-rules";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useMutation } from "@/lib/use-mutation";

export function SecurityCard({ strong = false, phone }: { strong?: boolean; phone?: string }) {
  const router = useRouter();
  const [pwOpen, setPwOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const { run, busy, fields } = useMutation();
  return (
    <Card>
      <CardHeader title="Security" />
      <div className="divide-y divide-border border-t border-border">
        <button type="button" onClick={() => setPwOpen(true)} className="flex min-h-14 w-full items-center gap-3 px-4 text-start text-[15px] font-medium hover:bg-surface-2">
          <KeyRound className="size-5 text-muted" aria-hidden /> Change password
        </button>
        <button type="button" onClick={() => setAllOpen(true)} className="flex min-h-14 w-full items-center gap-3 px-4 text-start text-[15px] font-medium hover:bg-surface-2">
          <MonitorSmartphone className="size-5 text-muted" aria-hidden /> Sign out of all devices
        </button>
      </div>

      <Sheet
        open={pwOpen}
        onOpenChange={setPwOpen}
        title="Change password"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button
              loading={busy}
              disabled={!current || !passwordOk(next, strong, phone)}
              onClick={async () => {
                const r = await run(() => api("/me/password", { body: { current, next } }), { success: "Password changed" });
                if (r !== undefined) {
                  setPwOpen(false);
                  setCurrent("");
                  setNext("");
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Current password" error={fields.current}>{(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
          <Field label="New password" error={fields.next}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}</Field>
          <PasswordChecklist password={next} strong={strong} phone={phone} />
        </div>
      </Sheet>

      <Sheet
        open={allOpen}
        onOpenChange={setAllOpen}
        size="sm"
        title="Sign out everywhere?"
        description="You'll be signed out on every phone and computer, including this one."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAllOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                await run(() => api("/auth/logout-all", { body: {} }), { refresh: false });
                router.replace("/login");
              }}
            >
              <LogOut aria-hidden /> Sign out everywhere
            </Button>
          </>
        }
      />
    </Card>
  );
}

export function NameCard({ name }: { name: string }) {
  return (
    <Card>
      <CardBody className="pt-4 text-sm text-muted">
        To change your name or mobile number, ask the academy office. {name && <span className="sr-only">{name}</span>}
      </CardBody>
    </Card>
  );
}
