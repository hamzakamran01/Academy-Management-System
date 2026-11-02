"use client";

import { Link2, Power, PowerOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { SetupLinkSheet, type SetupLinkInfo } from "@/components/setup-link-sheet";
import { api } from "@/lib/api";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { useMutation } from "@/lib/use-mutation";

/** New setup link / deactivate / reactivate for one person's role. */
export function AccountActions({
  userId,
  role,
  name,
  phone,
  active,
  academyName,
}: {
  userId: string;
  role: Role;
  name: string;
  phone: string;
  active: boolean;
  academyName: string;
}) {
  const { run, busy } = useMutation();
  const [link, setLink] = useState<SetupLinkInfo | null>(null);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        loading={busy && !confirm}
        onClick={async () => {
          const res = await run(() => api<{ setupLink: string }>(`/users/${userId}/setup-link`, { body: { role } }), { refresh: false });
          if (res) setLink({ name, phone, setupLink: res.setupLink });
        }}
      >
        <Link2 aria-hidden /> New setup link
      </Button>
      {active ? (
        <Button variant="danger-soft" size="sm" onClick={() => setConfirm(true)}>
          <PowerOff aria-hidden /> Deactivate
        </Button>
      ) : (
        <Button
          variant="soft"
          size="sm"
          loading={busy}
          onClick={() => run(() => api(`/users/${userId}/activate`, { body: { role } }), { success: "Account reactivated" })}
        >
          <Power aria-hidden /> Reactivate
        </Button>
      )}

      <Sheet
        open={confirm}
        onOpenChange={setConfirm}
        size="sm"
        title={`Deactivate ${name}?`}
        description={`They will be signed out of the ${ROLE_LABEL[role]} role on every device within a minute. History stays. You can reactivate later.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                await run(() => api(`/users/${userId}/deactivate`, { body: { role } }), { success: "Account deactivated" });
                setConfirm(false);
              }}
            >
              Deactivate
            </Button>
          </>
        }
      />
      <SetupLinkSheet info={link} academyName={academyName} onClose={() => setLink(null)} />
    </div>
  );
}
