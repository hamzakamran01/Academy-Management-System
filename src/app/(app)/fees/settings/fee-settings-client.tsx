"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, SearchInput } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useMutation } from "@/lib/use-mutation";

type ClassFee = { id: string; name: string; monthlyFee: number | null; students: number };
type Personal = { studentId: string; name: string; registrationNo: string; monthlyFee: number; note: string | null; className: string | null; classFee: number | null };
type StudentOpt = { id: string; name: string; className: string | null; registrationNo: string };

function AlsoThisMonth({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-2/60 p-3">
      <input type="checkbox" className="mt-0.5 size-5 accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">
        <span className="font-semibold">Also update this month</span>
        <span className="block text-muted">Only this month's <b>unpaid</b> rows change. Paid and waived months never change. Otherwise the new amount applies from next month.</span>
      </span>
    </label>
  );
}

export function ClassFees({ classes }: { classes: ClassFee[] }) {
  const [editing, setEditing] = useState<ClassFee | null>(null);
  const [amount, setAmount] = useState("");
  const [also, setAlso] = useState(false);
  const { run, busy, fields } = useMutation();
  const monthly = classes.reduce((n, c) => n + (c.monthlyFee ?? 0) * c.students, 0);

  return (
    <Card>
      <CardHeader title="Class default fees" description={`If every student paid the class default: ${formatMoney(monthly)} / month`} />
      <ul className="divide-y divide-border border-t border-border">
        {classes.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.name}</p>
              <p className="text-[13px] text-muted">{c.students} students</p>
            </div>
            {c.monthlyFee == null ? <Badge tone="warning">Not set</Badge> : <span className="tabular font-semibold">{formatMoney(c.monthlyFee)}</span>}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit fee for ${c.name}`}
              onClick={() => {
                setEditing(c);
                setAmount(c.monthlyFee?.toString() ?? "");
                setAlso(false);
              }}
            >
              <Pencil />
            </Button>
          </li>
        ))}
      </ul>
      <Sheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={`Monthly fee · ${editing?.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                const res = await run(() => api<{ updated: number }>(`/classes/${editing!.id}/fee`, { method: "PUT", body: { monthlyFee: Number(amount), alsoThisMonth: also } }), {
                  success: "Class fee saved",
                });
                if (res) setEditing(null);
              }}
            >
              Save fee
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Monthly fee (Rs)" required error={fields.monthlyFee}>
            {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={50} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />}
          </Field>
          <AlsoThisMonth checked={also} onChange={setAlso} />
        </div>
      </Sheet>
    </Card>
  );
}

export function PersonalFees({ personal, students }: { personal: Personal[]; students: StudentOpt[] }) {
  const [editing, setEditing] = useState<{ studentId: string; name: string; fee: string; note: string; isNew: boolean } | null>(null);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [also, setAlso] = useState(false);
  const { run, busy, fields } = useMutation();
  const has = new Set(personal.map((p) => p.studentId));
  const options = useMemo(() => {
    const t = q.trim().toLowerCase();
    return students.filter((s) => !has.has(s.id) && (!t || s.name.toLowerCase().includes(t) || s.registrationNo.toLowerCase().includes(t))).slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, q, personal]);

  return (
    <Card>
      <CardHeader
        title="Personal fees"
        description="Discounts, siblings, scholarships (Rs 0). Overrides the class default."
        action={
          <Button size="sm" variant="soft" onClick={() => setPicking(true)}>
            <Plus aria-hidden /> Add
          </Button>
        }
      />
      {personal.length === 0 ? (
        <EmptyState icon={Plus} title="No personal fees" description="Every student pays their class default." className="py-8" />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {personal.map((p) => (
            <li key={p.studentId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="truncate text-[13px] text-muted">
                  {p.className ?? "—"}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
              <div className="text-end">
                <p className="tabular font-semibold">{formatMoney(p.monthlyFee)}</p>
                {p.classFee != null && p.classFee !== p.monthlyFee && <p className="tabular text-xs text-muted line-through">{formatMoney(p.classFee)}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit personal fee for ${p.name}`}
                onClick={() => {
                  setAlso(false);
                  setEditing({ studentId: p.studentId, name: p.name, fee: String(p.monthlyFee), note: p.note ?? "", isNew: false });
                }}
              >
                <Pencil />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={picking} onOpenChange={setPicking} title="Choose a student">
        <SearchInput placeholder="Search by name or reg. no." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <ul className="mt-3 divide-y divide-border">
          {options.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-1 py-3 text-start hover:bg-surface-2"
                onClick={() => {
                  setPicking(false);
                  setAlso(false);
                  setEditing({ studentId: s.id, name: s.name, fee: "", note: "", isNew: true });
                }}
              >
                <Avatar name={s.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block text-[13px] text-muted">{s.className ?? "—"} · {s.registrationNo}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={`Personal fee · ${editing?.name}`}
        footer={
          <>
            {!editing?.isNew && (
              <Button
                variant="danger-soft"
                loading={busy}
                onClick={async () => {
                  const r = await run(() => api(`/students/${editing!.studentId}/fee`, { method: "DELETE", body: { alsoThisMonth: also } }), { success: "Personal fee removed" });
                  if (r !== undefined) setEditing(null);
                }}
              >
                <Trash2 aria-hidden /> Use class fee
              </Button>
            )}
            <Button
              loading={busy}
              onClick={async () => {
                const r = await run(
                  () => api(`/students/${editing!.studentId}/fee`, { method: "PUT", body: { monthlyFee: Number(editing!.fee), note: editing!.note || null, alsoThisMonth: also } }),
                  { success: "Personal fee saved" },
                );
                if (r !== undefined) setEditing(null);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Monthly fee (Rs)" required error={fields.monthlyFee} hint="Use 0 for a full scholarship">
              {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={50} value={editing.fee} onChange={(e) => setEditing({ ...editing, fee: e.target.value })} autoFocus />}
            </Field>
            <Field label="Note" optional hint='e.g. "Sibling discount"'>
              {(p) => <Input {...p} value={editing.note} maxLength={120} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />}
            </Field>
            <AlsoThisMonth checked={also} onChange={setAlso} />
          </div>
        )}
      </Sheet>
    </Card>
  );
}
