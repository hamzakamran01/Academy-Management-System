"use client";

import { CalendarDays, Check, FilePlus2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useMutation } from "@/lib/use-mutation";

type T = "weekly" | "monthly";
const TYPES: { v: T; l: string; hint: string }[] = [
  { v: "weekly", l: "Weekly", hint: "Short test" },
  { v: "monthly", l: "Monthly", hint: "End of month" },
];
const QUICK_TOTALS = [10, 20, 25, 50, 100];

type Option = { id: string; className: string; subjectName: string };

/**
 * New test in three taps: class → Weekly/Monthly → total marks.
 * The name is generated ("Weekly test · 03 Nov") unless the teacher types one.
 */
export function CreateTestButton({ options, today, preselect }: { options: Option[]; today: string; preselect?: string }) {
  const router = useRouter();
  const pre = preselect && options.some((o) => o.id === preselect) ? preselect : undefined;
  const [open, setOpen] = useState(!!pre);
  const [cs, setCs] = useState(pre ?? (options.length === 1 ? options[0]!.id : ""));
  const [type, setType] = useState<T>("weekly");
  const [total, setTotal] = useState("25");
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [filter, setFilter] = useState("");
  const { run, busy, fields } = useMutation();

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? options.filter((o) => `${o.subjectName} ${o.className}`.toLowerCase().includes(q)) : options;
  }, [filter, options]);
  const totalNum = Number(total);
  const ready = !!cs && totalNum > 0;

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!options.length}>
        <FilePlus2 aria-hidden /> <span>New test</span>
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="New test"
        description="Next you'll type marks next to each student's name."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              loading={busy}
              disabled={!ready}
              onClick={async () => {
                const r = await run(() => api<{ id: string }>("/assessments", { body: { classSubjectId: cs, type, title: title.trim() || null, date, totalMarks: totalNum } }), { refresh: false });
                if (r) router.push(`/results/${r.id}`);
              }}
            >
              Create & enter marks
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* 1 · Class */}
          <section>
            <StepLabel n={1}>Which class?</StepLabel>
            {options.length > 6 && (
              <SearchInput className="mb-2" placeholder="Find class or subject" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Find class or subject" />
            )}
            <div className="max-h-64 space-y-1.5 overflow-y-auto pe-0.5" role="radiogroup" aria-label="Class and subject">
              {shown.map((o) => {
                const on = cs === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setCs(o.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-start transition-[background-color,border-color,transform] active:scale-[0.985]",
                      on ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-2",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[15px] font-semibold", on && "text-primary-soft-fg")}>{o.subjectName}</span>
                      <span className="block truncate text-[13px] text-muted">{o.className}</span>
                    </span>
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors", on ? "border-primary bg-primary text-primary-fg" : "border-border-strong")}>
                      {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                    </span>
                  </button>
                );
              })}
              {!shown.length && <p className="py-4 text-center text-sm text-muted">Nothing matches “{filter}”.</p>}
            </div>
            {fields.classSubjectId && <p className="mt-1.5 text-sm text-danger-fg">{fields.classSubjectId}</p>}
          </section>

          {/* 2 · Type */}
          <section>
            <StepLabel n={2}>Weekly or monthly?</StepLabel>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Test type">
              {TYPES.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  role="radio"
                  aria-checked={type === t.v}
                  onClick={() => setType(t.v)}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center rounded-xl border transition-[background-color,border-color,transform] active:scale-[0.97]",
                    type === t.v ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  <span className="text-base font-bold">{t.l}</span>
                  <span className="text-xs opacity-75">{t.hint}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 3 · Total */}
          <section>
            <StepLabel n={3}>Total marks</StepLabel>
            <div className="flex flex-wrap items-center gap-2">
              {QUICK_TOTALS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={totalNum === n}
                  onClick={() => setTotal(String(n))}
                  className={cn(
                    "tabular inline-flex h-11 min-w-12 items-center justify-center rounded-lg border px-3 text-[15px] font-semibold transition-[background-color,transform] active:scale-95",
                    totalNum === n ? "border-fg bg-fg text-bg" : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  {n}
                </button>
              ))}
              <Input
                aria-label="Other total"
                type="number"
                inputMode="decimal"
                min={1}
                step={0.5}
                placeholder="Other"
                value={QUICK_TOTALS.includes(totalNum) ? "" : total}
                onChange={(e) => setTotal(e.target.value)}
                className="h-11 w-24"
              />
            </div>
            {fields.totalMarks && <p className="mt-1.5 text-sm text-danger-fg">{fields.totalMarks}</p>}
          </section>

          {/* Optional details */}
          {showMore ? (
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-surface-2 p-3 sm:grid-cols-2">
              <Field label="Name" optional hint="Leave blank for an automatic name" error={fields.title}>
                {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "weekly" ? "Weekly test" : "Monthly test"} />}
              </Field>
              <Field label="Test date" error={fields.date}>
                {(p) => <Input {...p} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />}
              </Field>
            </div>
          ) : (
            <button type="button" onClick={() => setShowMore(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <CalendarDays className="size-4" aria-hidden /> Change date or name (optional)
            </button>
          )}
        </div>
      </Sheet>
    </>
  );
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold">
      <span className="tabular flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">{n}</span>
      {children}
    </p>
  );
}
