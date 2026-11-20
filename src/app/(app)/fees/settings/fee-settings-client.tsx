"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useMutation } from "@/lib/use-mutation";

export function StudentFeeEditor({ studentId, name, monthlyFee, paperFee, note }: {
  studentId: string;
  name: string;
  monthlyFee?: number;
  paperFee?: number | null;
  note?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="soft" className="min-h-12" onClick={() => setOpen(true)} aria-label={`${monthlyFee == null ? "Set" : "Edit"} monthly fee for ${name}`}>
        <Pencil aria-hidden /> {monthlyFee == null ? "Set fee" : "Edit fee"}
      </Button>
      {open && <FeeSheet studentId={studentId} name={name} monthlyFee={monthlyFee} paperFee={paperFee} note={note} close={() => setOpen(false)} />}
    </>
  );
}

function FeeSheet({ studentId, name, monthlyFee, paperFee, note, close }: {
  studentId: string;
  name: string;
  monthlyFee?: number;
  paperFee?: number | null;
  note?: string | null;
  close: () => void;
}) {
  const [amount, setAmount] = useState(monthlyFee?.toString() ?? "");
  const [paper, setPaper] = useState(paperFee?.toString() ?? "");
  const [memo, setMemo] = useState(note ?? "");
  const [alsoThisMonth, setAlsoThisMonth] = useState(monthlyFee == null);
  const { run, busy, fields } = useMutation();

  return (
    <Sheet
      open
      onOpenChange={(open) => { if (!open && !busy) close(); }}
      title={`Fees for ${name}`}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={close}>Cancel</Button>
          <Button loading={busy} type="submit" form="student-monthly-fee">Save fee</Button>
        </>
      }
    >
      <form id="student-monthly-fee" className="space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        const result = await run(() => api(`/students/${studentId}/fee`, {
          method: "PUT",
          body: { monthlyFee: Number(amount), paperFee: Number(paper), note: memo || null, alsoThisMonth },
        }), { success: "Fees saved" });
        if (result !== undefined) close();
      }}>
        <Field label="Monthly fee (Rs)" required error={fields.monthlyFee} hint="Enter 0 for a full scholarship.">
          {(props) => <Input {...props} required type="number" inputMode="numeric" min={0} max={10000000} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} />}
        </Field>
        <Field label="Paper money (Rs)" optional error={fields.paperFee} hint="Leave blank if the student has no monthly paper charge.">
          {(props) => <Input {...props} type="number" inputMode="numeric" min={0} max={10000000} step={1} value={paper} onChange={(event) => setPaper(event.target.value)} />}
        </Field>
        <Field label="Note" optional error={fields.note}>
          {(props) => <Input {...props} value={memo} maxLength={120} onChange={(event) => setMemo(event.target.value)} placeholder="e.g. Sibling discount" />}
        </Field>
        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" checked={alsoThisMonth} onChange={(event) => setAlsoThisMonth(event.target.checked)} />
          <span>
            <span className="block font-semibold">Apply to this month too</span>
            <span className="text-muted">Updates unpaid charges for this month. Paid amounts stay as recorded.</span>
          </span>
        </label>
      </form>
    </Sheet>
  );
}
