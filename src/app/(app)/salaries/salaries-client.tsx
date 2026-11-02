"use client";

import { CheckCircle2, Hourglass, Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/data";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { useMutation } from "@/lib/use-mutation";

type Item = {
  userId: string;
  name: string;
  roles: string[];
  salary: number | null;
  nextChange: string | null;
  row: { id: string; amount: number; status: "pending" | "paid"; paidOn: string | null; note: string | null } | null;
};

export function SalaryList({ items, months, today }: { items: Item[]; months: string[]; today: string }) {
  const [editing, setEditing] = useState<Item | null>(null);
  const [paying, setPaying] = useState<Item | null>(null);
  const { run, busy } = useMutation();

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        {items.map((i) => (
          <li key={i.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Avatar name={i.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.name}</p>
              <p className="truncate text-[13px] text-muted">
                {i.roles.includes("teacher") ? "Teacher" : "Admin staff"} ·{" "}
                {i.salary != null ? <span className="tabular font-semibold text-fg">{formatMoney(i.salary)}</span> : <span className="text-warning-fg">Salary not set</span>}
                {i.nextChange && ` · changes ${formatMonth(i.nextChange, true)}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {i.row ? (
                i.row.status === "paid" ? (
                  <button
                    type="button"
                    onClick={() => run(() => api(`/salaries/rows/${i.row!.id}/pending`, { body: {} }), { success: "Marked pending" })}
                    className="group inline-flex h-10 items-center gap-1.5 rounded-lg bg-success-soft px-3 text-sm font-semibold text-success-fg"
                    aria-label={`${i.name}: paid${i.row.paidOn ? ` on ${formatDate(i.row.paidOn)}` : ""}. Tap to mark pending`}
                    disabled={busy}
                  >
                    <CheckCircle2 className="size-4 group-hover:hidden" aria-hidden />
                    <RotateCcw className="hidden size-4 group-hover:block" aria-hidden />
                    Paid {i.row.paidOn ? formatDate(i.row.paidOn).slice(0, 6) : ""}
                  </button>
                ) : (
                  <Button size="sm" variant="success" onClick={() => setPaying(i)}>
                    <Hourglass aria-hidden /> Mark paid
                  </Button>
                )
              ) : (
                <Badge>No row</Badge>
              )}
              <Button variant="ghost" size="icon-sm" aria-label={`Set salary for ${i.name}`} onClick={() => setEditing(i)}>
                <Pencil />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editing && <SetSalarySheet item={editing} months={months} onClose={() => setEditing(null)} />}
      {paying && <PaySheet item={paying} today={today} onClose={() => setPaying(null)} />}
    </>
  );
}

function SetSalarySheet({ item, months, onClose }: { item: Item; months: string[]; onClose: () => void }) {
  const [amount, setAmount] = useState(item.salary?.toString() ?? "");
  const [from, setFrom] = useState(months[0]!);
  const { run, busy, fields } = useMutation();
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Salary · ${item.name}`}
      description="History is kept. If it starts this month, a pending salary row for this month is updated; paid months never change."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={busy}
            onClick={async () => {
              const r = await run(() => api(`/users/${item.userId}/salary`, { method: "PUT", body: { monthlySalary: Number(amount), effectiveFrom: from } }), { success: "Salary saved" });
              if (r !== undefined) onClose();
            }}
          >
            Save salary
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Monthly salary (Rs)" required error={fields.monthlySalary}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={500} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />}
        </Field>
        <Field label="Effective from" required error={fields.effectiveFrom}>
          {(p) => (
            <Select {...p} value={from} onChange={(e) => setFrom(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Sheet>
  );
}

function PaySheet({ item, today, onClose }: { item: Item; today: string; onClose: () => void }) {
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const { run, busy } = useMutation();
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={`Pay ${item.name}`}
      description={`${formatMoney(item.row!.amount)} for this month. ${item.name.split(" ")[0]} is notified (without the amount).`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="success"
            loading={busy}
            onClick={async () => {
              const r = await run(() => api(`/salaries/rows/${item.row!.id}/paid`, { body: { paidOn, note: note || null } }), { success: "Salary marked paid" });
              if (r !== undefined) onClose();
            }}
          >
            Mark paid
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Paid on" required>{(p) => <Input {...p} type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />}</Field>
        <Field label="Note" optional hint="e.g. bank transfer, cash">{(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      </div>
    </Sheet>
  );
}

export function GenerateSalariesButton({ month }: { month: string }) {
  const { run, busy } = useMutation();
  return (
    <Button loading={busy} onClick={() => run(() => api("/salaries/generate", { body: { month } }), { success: `${formatMonth(month)} salary list created` })}>
      Create {formatMonth(month, true)} salary list
    </Button>
  );
}

