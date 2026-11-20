"use client";

import { Pencil, ReceiptText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { formatMoney } from "@/lib/format";
import { api } from "@/lib/api";
import { useMutation } from "@/lib/use-mutation";

export function StudentFeeEditor({ studentId, name, monthlyFee, paperFee, classPaperFee, note }: {
  studentId: string;
  name: string;
  monthlyFee?: number;
  paperFee?: number | null;
  classPaperFee?: number | null;
  note?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="soft" className="min-h-12" onClick={() => setOpen(true)} aria-label={`${monthlyFee == null ? "Set" : "Edit"} monthly fee for ${name}`}>
        <Pencil aria-hidden /> {monthlyFee == null ? "Set fee" : "Edit fee"}
      </Button>
      {open && <FeeSheet studentId={studentId} name={name} monthlyFee={monthlyFee} paperFee={paperFee} classPaperFee={classPaperFee} note={note} close={() => setOpen(false)} />}
    </>
  );
}

function FeeSheet({ studentId, name, monthlyFee, paperFee, classPaperFee, note, close }: {
  studentId: string;
  name: string;
  monthlyFee?: number;
  paperFee?: number | null;
  classPaperFee?: number | null;
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
          body: { monthlyFee: Number(amount), paperFee: paper.trim() ? Number(paper) : null, note: memo || null, alsoThisMonth },
        }), { success: "Fees saved" });
        if (result !== undefined) close();
      }}>
        <Field label="Monthly fee (Rs)" required error={fields.monthlyFee} hint="Enter 0 for a full scholarship.">
          {(props) => <Input {...props} required type="number" inputMode="numeric" min={0} max={10000000} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} />}
        </Field>
        <Field label="Paper money (Rs)" optional error={fields.paperFee} hint={`Leave blank to use the class rate (${classPaperFee ? formatMoney(classPaperFee) : "no charge"}). Enter 0 for an individual exemption.`}>
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

export function ClassPaperEditor({ classId, name, amount }: { classId: string; name: string; amount: number | null }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Class paper money" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><ReceiptText className="size-5 text-primary" aria-hidden /> Class paper money</h2>
        <p className="mt-1 text-sm text-muted">{amount ? `${formatMoney(amount)} per student each month` : "No class rate set"}</p>
      </div>
      <Button variant="soft" className="min-h-12" onClick={() => setOpen(true)}>{amount ? "Edit class rate" : "Set class rate"}</Button>
      {open && <ClassPaperSheet classId={classId} name={name} amount={amount} close={() => setOpen(false)} />}
    </section>
  );
}

function ClassPaperSheet({ classId, name, amount, close }: { classId: string; name: string; amount: number | null; close: () => void }) {
  const [paper, setPaper] = useState(amount?.toString() ?? "");
  const [alsoThisMonth, setAlsoThisMonth] = useState(true);
  const { run, busy, fields } = useMutation();
  return (
    <Sheet
      open
      onOpenChange={(open) => { if (!open && !busy) close(); }}
      title={`Paper money for ${name}`}
      description="The class rate applies to students who use the default. Individual rates and exemptions take priority."
      footer={<>
        <Button variant="secondary" disabled={busy} onClick={close}>Cancel</Button>
        <Button type="submit" form="class-paper-rate" loading={busy}>Save class rate</Button>
      </>}
    >
      <form id="class-paper-rate" className="space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        const result = await run(() => api(`/classes/${classId}/paper-fee`, {
          method: "PUT", body: { paperFee: Number(paper), alsoThisMonth },
        }), { success: "Class paper money saved" });
        if (result !== undefined) close();
      }}>
        <Field label="Paper money per student (Rs)" required error={fields.paperFee} hint="Enter 0 to remove the class rate.">
          {(props) => <Input {...props} required type="number" inputMode="numeric" min={0} max={10000000} step={1} value={paper} onChange={(event) => setPaper(event.target.value)} />}
        </Field>
        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" checked={alsoThisMonth} onChange={(event) => setAlsoThisMonth(event.target.checked)} />
          <span>
            <span className="block font-semibold">Apply to this month too</span>
            <span className="text-muted">Updates existing records for students using the class rate. Paper money already marked paid stays unchanged.</span>
          </span>
        </label>
      </form>
    </Sheet>
  );
}
