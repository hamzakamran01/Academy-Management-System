"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useMutation } from "@/lib/use-mutation";

export type Option = { id: string; name: string };
export type ClassValues = { id?: string; name: string; shift: string | null };

const SHIFTS = ["Morning", "Evening"];

/** Add / edit class (FR-ORG-04). On create, subjects can be attached in the same step. */
export function ClassFormSheet({
  initial,
  subjects,
  onClose,
}: {
  initial?: ClassValues;
  subjects?: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = !!initial?.id;
  const [v, setV] = useState<ClassValues>(initial ?? { name: "", shift: null });
  const [picked, setPicked] = useState<string[]>([]);
  const { run, busy, fields } = useMutation();
  const set = <K extends keyof ClassValues>(k: K, val: ClassValues[K]) => setV((s) => ({ ...s, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { name: v.name, shift: v.shift };
    const res = editing
      ? await run(() => api(`/classes/${initial!.id}`, { method: "PATCH", body }), { success: "Class updated" })
      : await run(() => api<{ id: string }>("/classes", { body: { ...body, subjectIds: picked } }), { success: "Class added" });
    if (res !== undefined) {
      onClose();
      if (!editing && res && typeof res === "object" && "id" in res) router.push(`/classes/${(res as { id: string }).id}`);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Edit class" : "Add class"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="class-form" loading={busy}>{editing ? "Save" : "Add class"}</Button>
        </>
      }
    >
      <form id="class-form" onSubmit={submit} className="space-y-4">
        <Field label="Class name" required error={fields.name} hint='e.g. "Grade 9 – A" or "FSc Pre-Medical – Evening"'>
          {(p) => <Input {...p} value={v.name} onChange={(e) => set("name", e.target.value)} autoFocus={!editing} />}
        </Field>
        <Field label="Shift" optional>
          {(p) => (
            <div className="flex gap-2" role="radiogroup" aria-labelledby={p.id}>
              {[null, ...SHIFTS].map((s) => (
                <button
                  key={s ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={v.shift === s}
                  onClick={() => set("shift", s)}
                  className={cn(
                    "h-11 flex-1 rounded-lg border text-sm font-medium transition-colors",
                    v.shift === s ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  {s ?? "None"}
                </button>
              ))}
            </div>
          )}
        </Field>
        {!editing && subjects && subjects.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Subjects <span className="text-xs font-normal text-subtle">— pick a teacher for each one next</span></legend>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => {
                const on = picked.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                    className={cn(
                      "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                      on ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface hover:bg-surface-2",
                    )}
                  >
                    {on && <Check className="size-4" aria-hidden />}
                    {s.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      </form>
    </Sheet>
  );
}

export function AddClassButton({ subjects }: { subjects: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add class</Button>
      {open && <ClassFormSheet subjects={subjects} onClose={() => setOpen(false)} />}
    </>
  );
}
