"use client";

import { CalendarPlus, PartyPopper, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { diffDays } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { useMutation } from "@/lib/use-mutation";

const DAYS = [
  { n: 1, s: "Mon" },
  { n: 2, s: "Tue" },
  { n: 3, s: "Wed" },
  { n: 4, s: "Thu" },
  { n: 5, s: "Fri" },
  { n: 6, s: "Sat" },
  { n: 7, s: "Sun" },
];

type Holiday = { id: string; name: string; startDate: string; endDate: string };

export function WorkingDays({ yearId, initial, editable }: { yearId: string; initial: number[]; editable: boolean }) {
  const [days, setDays] = useState(initial);
  const { run, busy } = useMutation();
  const dirty = [...days].sort().join() !== [...initial].sort().join();
  return (
    <Card>
      <CardHeader title="Working days" description="Syllabus pace and reminders count only these days." />
      <CardBody>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((d) => {
            const on = days.includes(d.n);
            return (
              <button
                key={d.n}
                type="button"
                disabled={!editable}
                aria-pressed={on}
                onClick={() => setDays((x) => (on ? x.filter((y) => y !== d.n) : [...x, d.n]))}
                className={cn(
                  "h-12 rounded-lg border text-sm font-semibold transition-colors disabled:cursor-default",
                  on ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-muted hover:bg-surface-2",
                )}
              >
                {d.s}
              </button>
            );
          })}
        </div>
        {editable && dirty && (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              loading={busy}
              onClick={() => run(() => api(`/academic-years/${yearId}`, { method: "PATCH", body: { workingDays: days.sort() } }), { success: "Working days saved" })}
            >
              Save working days
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function Holidays({ holidays, editable, today }: { holidays: Holiday[]; editable: boolean; today: string }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [removing, setRemoving] = useState<Holiday | null>(null);
  const { run, busy, fields } = useMutation();
  const upcoming = holidays.filter((h) => h.endDate >= today);
  const past = holidays.filter((h) => h.endDate < today);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() => api("/holidays", { body: { name, startDate: start, endDate: end || start } }), { success: "Holiday added" });
    if (res !== undefined) {
      setAdding(false);
      setName("");
      setStart("");
      setEnd("");
    }
  }

  const row = (h: Holiday, dim = false) => {
    const days = diffDays(h.startDate, h.endDate) + 1;
    return (
      <li key={h.id} className={cn("flex items-center gap-3 px-4 py-3", dim && "opacity-60")}>
        <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-warning-soft text-warning-fg">
          <span className="text-[11px] font-semibold uppercase leading-none">{formatDate(h.startDate).split(" ")[1]}</span>
          <span className="text-lg font-bold leading-tight">{h.startDate.slice(8)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{h.name}</p>
          <p className="text-[13px] text-muted">
            {days === 1 ? formatDate(h.startDate) : `${formatDate(h.startDate)} – ${formatDate(h.endDate)} · ${days} days`}
          </p>
        </div>
        {editable && (
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${h.name}`} onClick={() => setRemoving(h)}>
            <Trash2 />
          </Button>
        )}
      </li>
    );
  };

  return (
    <Card>
      <CardHeader
        title="Holidays"
        description="Visible to everyone. No class logs are expected and no reminders are sent."
        action={
          editable && (
            <Button size="sm" variant="soft" onClick={() => setAdding(true)}>
              <CalendarPlus aria-hidden /> Add
            </Button>
          )
        }
      />
      {holidays.length === 0 ? (
        <EmptyState icon={PartyPopper} title="No holidays added" className="py-8" />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {upcoming.map((h) => row(h))}
          {past.length > 0 && <li className="bg-surface-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">Past</li>}
          {past.map((h) => row(h, true))}
        </ul>
      )}

      <Sheet
        open={adding}
        onOpenChange={setAdding}
        title="Add holiday"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" form="holiday-form" loading={busy}>Add holiday</Button>
          </>
        }
      >
        <form id="holiday-form" onSubmit={add} className="space-y-4">
          <Field label="Name" required error={fields.name}>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eid ul Adha" autoFocus />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" required error={fields.startDate}>
              {(p) => <Input {...p} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}
            </Field>
            <Field label="To" optional error={fields.endDate} hint="Leave empty for one day">
              {(p) => <Input {...p} type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />}
            </Field>
          </div>
        </form>
      </Sheet>

      <Sheet
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        size="sm"
        title={`Remove ${removing?.name}?`}
        description="These days become working days again."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                await run(() => api(`/holidays/${removing!.id}`, { method: "DELETE" }), { success: "Holiday removed" });
                setRemoving(null);
              }}
            >
              Remove
            </Button>
          </>
        }
      />
    </Card>
  );
}
