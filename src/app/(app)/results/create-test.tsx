"use client";

import { FilePlus2, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useMutation } from "@/lib/use-mutation";

const TYPES = [
  { v: "weekly", l: "Weekly" },
  { v: "monthly", l: "Monthly" },
  { v: "midterm", l: "Mid-term" },
  { v: "final", l: "Final" },
  { v: "other", l: "Other" },
] as const;
type T = (typeof TYPES)[number]["v"];

const DEFAULT_TITLE: Record<T, string> = { weekly: "Weekly test", monthly: "Monthly test", midterm: "Mid-term exam", final: "Final exam", other: "" };

function TypeChips({ value, onChange }: { value: T; onChange: (t: T) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Type">
      {TYPES.map((t) => (
        <button
          key={t.v}
          type="button"
          role="radio"
          aria-checked={value === t.v}
          onClick={() => onChange(t.v)}
          className={cn(
            "h-10 rounded-lg border text-[13px] font-medium",
            value === t.v ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface hover:bg-surface-2",
          )}
        >
          {t.l}
        </button>
      ))}
    </div>
  );
}

export function CreateTestButton({ options, today, preselect }: { options: { id: string; className: string; subjectName: string }[]; today: string; preselect?: string }) {
  const router = useRouter();
  const pre = preselect && options.some((o) => o.id === preselect) ? preselect : undefined;
  const [open, setOpen] = useState(!!pre);
  const [cs, setCs] = useState(pre ?? (options.length === 1 ? options[0]!.id : ""));
  const [type, setType] = useState<T>("weekly");
  const [title, setTitle] = useState(DEFAULT_TITLE.weekly);
  const [date, setDate] = useState(today);
  const [total, setTotal] = useState("25");
  const { run, busy, fields } = useMutation();

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!options.length}>
        <FilePlus2 aria-hidden /> <span>New test</span>
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="New test"
        description="Then type marks in front of each student's name."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                const r = await run(
                  () => api<{ id: string }>("/assessments", { body: { classSubjectId: cs, type, title, date, totalMarks: Number(total) } }),
                  { refresh: false },
                );
                if (r) router.push(`/results/${r.id}`);
              }}
            >
              Create & enter marks
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Class & subject" required error={fields.classSubjectId}>
            {(p) => (
              <Select {...p} value={cs} onChange={(e) => setCs(e.target.value)}>
                <option value="">Choose</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.subjectName} · {o.className}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Type">
            {() => (
              <TypeChips
                value={type}
                onChange={(t) => {
                  setType(t);
                  if (!title || Object.values(DEFAULT_TITLE).includes(title)) setTitle(DEFAULT_TITLE[t]);
                }}
              />
            )}
          </Field>
          <Field label="Title" required error={fields.title} hint='e.g. "Weekly Test 5 — Ch 4"'>
            {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required error={fields.date}>
              {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
            </Field>
            <Field label="Total marks" required error={fields.totalMarks}>
              {(p) => <Input {...p} type="number" inputMode="decimal" min={1} step={0.5} value={total} onChange={(e) => setTotal(e.target.value)} />}
            </Field>
          </div>
        </div>
      </Sheet>
    </>
  );
}

/** FR-RES-02: admin creates an exam for a whole class → one draft per subject. */
export function CreateExamButton({ classes, today }: { classes: { id: string; name: string }[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [type, setType] = useState<T>("midterm");
  const [title, setTitle] = useState(DEFAULT_TITLE.midterm);
  const [date, setDate] = useState(today);
  const [total, setTotal] = useState("100");
  const { run, busy, fields } = useMutation();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Layers aria-hidden /> <span className="sm:hidden">Exam</span><span className="hidden sm:inline">Whole-class exam</span>
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Exam for a whole class"
        description="Creates one draft test per subject for each subject teacher."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                const r = await run(() => api<{ tests: number }>("/exam-groups", { body: { classId, type, title, date, totalMarks: Number(total) } }), {
                  success: "Exam created for every subject",
                });
                if (r) setOpen(false);
              }}
            >
              Create exam
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Class" required error={fields.classId}>
            {(p) => (
              <Select {...p} value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Choose class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Type">{() => <TypeChips value={type} onChange={(t) => { setType(t); setTitle(DEFAULT_TITLE[t]); }} />}</Field>
          <Field label="Title" required error={fields.title}>
            {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Total marks" required error={fields.totalMarks}>
              {(p) => <Input {...p} type="number" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />}
            </Field>
          </div>
        </div>
      </Sheet>
    </>
  );
}
