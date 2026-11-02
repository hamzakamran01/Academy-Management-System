"use client";

import { UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, ListCard, ListRow } from "@/components/ui/data";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, SearchInput } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SetupLinkSheet, type SetupLinkInfo } from "@/components/setup-link-sheet";
import { api } from "@/lib/api";
import { formatPhone } from "@/lib/phone";
import { formatRelative } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { useMutation } from "@/lib/use-mutation";
import { APP_NAME } from "@/lib/brand";

export type PersonItem = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  invited: boolean;
  lastActiveAt: string | null;
  extra?: string;
};

/** Searchable people list + "Add" sheet, shared by Teachers, Parents and Admins. */
export function PeopleList({
  role,
  people,
  canAdd,
  hrefBase,
  academyName,
}: {
  role: Role;
  people: PersonItem[];
  canAdd: boolean;
  hrefBase?: string;
  academyName: string;
}) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState<SetupLinkInfo | null>(null);
  const label = ROLE_LABEL[role].toLowerCase();

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digits = t.replace(/\D/g, "").replace(/^0/, "");
    return t ? people.filter((p) => p.name.toLowerCase().includes(t) || (digits && p.phone.includes(digits))) : people;
  }, [people, q]);
  const active = filtered.filter((p) => p.active);
  const inactive = filtered.filter((p) => !p.active);

  return (
    <>
      <div className="mb-4 flex gap-2">
        <SearchInput className="flex-1" placeholder={`Search ${label}s by name or phone`} value={q} onChange={(e) => setQ(e.target.value)} />
        {canAdd && (
          <Button onClick={() => setAdding(true)} className="shrink-0" aria-label={`Add ${label}`}>
            <UserPlus aria-hidden />
            <span className="hidden sm:inline">Add {label}</span>
          </Button>
        )}
      </div>

      {people.length === 0 ? (
        <EmptyState
          icon={Users}
          title={`No ${label}s yet`}
          description={canAdd ? `Add your first ${label}. They'll get a setup link to create a password.` : undefined}
          action={canAdd && <Button onClick={() => setAdding(true)}><UserPlus aria-hidden /> Add {label}</Button>}
        />
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No {label}s match “{q}”.</p>
      ) : (
        <div className="space-y-4">
          <p className="px-1 text-[13px] text-muted">
            {active.length} active{inactive.length ? ` · ${inactive.length} deactivated` : ""}
          </p>
          <ListCard>
            {[...active, ...inactive].map((p) => (
              <ListRow
                key={p.id}
                href={hrefBase ? `${hrefBase}/${p.id}` : undefined}
                leading={<Avatar name={p.name} />}
                title={p.name}
                subtitle={p.extra ?? `${formatPhone(p.phone)}${p.lastActiveAt ? ` · active ${formatRelative(p.lastActiveAt)}` : ""}`}
                trailing={!p.active ? <StatusBadge status="deactivated" /> : p.invited ? <StatusBadge status="invited" /> : null}
                className={!p.active ? "opacity-60" : undefined}
              />
            ))}
          </ListCard>
        </div>
      )}

      {adding && (
        <AddPersonSheet
          role={role}
          onClose={() => setAdding(false)}
          onCreated={(info) => {
            setAdding(false);
            setLink(info);
          }}
        />
      )}
      <SetupLinkSheet info={link} academyName={academyName} onClose={() => setLink(null)} />
    </>
  );
}

function AddPersonSheet({ role, onClose, onCreated }: { role: Role; onClose: () => void; onCreated: (i: SetupLinkInfo) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { run, busy, fields } = useMutation();
  const label = ROLE_LABEL[role];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() => api<SetupLinkInfo>("/users", { body: { name, phone, role } }), { success: `${label} added` });
    if (res) onCreated(res);
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Add ${label.toLowerCase()}`}
      description={`If this number already has a ${APP_NAME} account, the role is added to it.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-person" loading={busy}>Add {label.toLowerCase()}</Button>
        </>
      }
    >
      <form id="add-person" onSubmit={submit} className="space-y-4">
        <Field label="Full name" required error={fields.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" autoFocus />}
        </Field>
        <Field label="Mobile number" required error={fields.phone} hint="Used to sign in. Pakistani mobile numbers only.">
          {(p) => <Input {...p} type="tel" inputMode="tel" placeholder="0300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
      </form>
    </Sheet>
  );
}

export function PersonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-medium text-primary hover:underline">{children}</Link>;
}
