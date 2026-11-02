"use client";

import { ArrowRightLeft, CheckSquare, Square } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/data";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useMutation } from "@/lib/use-mutation";

export type Row = {
  id: string;
  name: string;
  registrationNo: string;
  status: "active" | "removed";
  className: string | null;
  rollNo: string | null;
  feeStatus: "paid" | "unpaid" | "waived" | null;
};

/** Student rows; in move mode rows become selectable for a bulk class move (FR-ORG-07). */
export function StudentList({
  rows,
  moveMode,
  classes,
  currentClassId,
  today,
  showFee,
}: {
  rows: Row[];
  moveMode: boolean;
  classes: { id: string; name: string }[];
  currentClassId?: string;
  today: string;
  showFee: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(moveMode ? rows.filter((r) => r.status === "active").map((r) => r.id) : []);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [date, setDate] = useState(today);
  const { run, busy } = useMutation();
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      {moveMode && (
        <Notice tone="info" className="mb-3" title="Select students to move">
          Everyone is selected. Untick anyone who should stay, then choose the new class.
        </Notice>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        {rows.map((r) => {
          const on = selected.includes(r.id);
          const body = (
            <>
              {moveMode ? (
                <span className={cn("flex size-10 shrink-0 items-center justify-center", on ? "text-primary" : "text-subtle")}>
                  {on ? <CheckSquare className="size-6" /> : <Square className="size-6" />}
                </span>
              ) : (
                <Avatar name={r.name} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{r.name}</p>
                <p className="truncate text-[13px] text-muted">
                  {r.className ? `${r.className} · Roll ${r.rollNo}` : "No class"} · {r.registrationNo}
                </p>
              </div>
              {r.status === "removed" ? (
                <StatusBadge status="removed" />
              ) : showFee && r.feeStatus ? (
                <StatusBadge status={r.feeStatus} />
              ) : null}
            </>
          );
          const cls = "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-2 active:bg-surface-3";
          return (
            <li key={r.id}>
              {moveMode ? (
                <button type="button" className={cls} onClick={() => toggle(r.id)} aria-pressed={on}>
                  {body}
                </button>
              ) : (
                <Link href={`/students/${r.id}`} className={cls}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {moveMode && (
        <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-xl lg:static lg:mt-4 lg:border-0 lg:bg-transparent lg:p-0">
          <Button block disabled={!selected.length} onClick={() => setOpen(true)} className="lg:w-auto">
            <ArrowRightLeft aria-hidden /> Move {selected.length} student{selected.length === 1 ? "" : "s"}
          </Button>
        </div>
      )}

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={`Move ${selected.length} student${selected.length === 1 ? "" : "s"}`}
        description="Attendance, results and fees so far stay in history. New roll numbers are assigned in the new class."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!target}
              loading={busy}
              onClick={async () => {
                const res = await run(() => api<{ moved: number; failed: { id: string; message: string }[] }>("/students/bulk-move", { body: { studentIds: selected, classId: target, date } }));
                if (res) {
                  setOpen(false);
                  setSelected([]);
                }
              }}
            >
              Move students
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="New class" required>
            {(p) => (
              <Select {...p} value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Choose class</option>
                {classes.filter((c) => c.id !== currentClassId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Moving from" required hint="New class's teachers see them from this date">
            {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        </div>
      </Sheet>
    </>
  );
}
