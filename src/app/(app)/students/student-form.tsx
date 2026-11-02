"use client";

import { Check, Plus, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StickyActions } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SetupLinkSheet, type SetupLinkInfo } from "@/components/setup-link-sheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useMutation } from "@/lib/use-mutation";

export type ClassOption = { id: string; name: string; nextRoll: string; subjects: { id: string; name: string }[] };
type Parent = { phone: string; name: string; relation: "father" | "mother" | "guardian" };

export type StudentFormValues = {
  name: string;
  guardianName: string;
  gender: "male" | "female" | "other";
  dob: string;
  address: string;
  notes: string;
  admissionDate: string;
  classId: string;
  rollNo: string;
  excluded: string[];
  parents: Parent[];
};

const RELATIONS = [
  { v: "father", l: "Father" },
  { v: "mother", l: "Mother" },
  { v: "guardian", l: "Guardian" },
] as const;

type AddResult = { id: string; registrationNo: string; parents: (SetupLinkInfo & { created: boolean })[] };

export function StudentForm({
  mode,
  studentId,
  initial,
  classes,
  today,
  academyName,
}: {
  mode: "add" | "edit";
  studentId?: string;
  initial?: Partial<StudentFormValues>;
  classes: ClassOption[];
  today: string;
  academyName: string;
}) {
  const router = useRouter();
  const { run, busy, fields } = useMutation();
  const [v, setV] = useState<StudentFormValues>({
    name: "",
    guardianName: "",
    gender: "male",
    dob: "",
    address: "",
    notes: "",
    admissionDate: today,
    classId: classes.length === 1 ? classes[0]!.id : "",
    rollNo: "",
    excluded: [],
    parents: [{ phone: "", name: "", relation: "father" }],
    ...initial,
  });
  const [links, setLinks] = useState<SetupLinkInfo[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const set = <K extends keyof StudentFormValues>(k: K, val: StudentFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const cls = useMemo(() => classes.find((c) => c.id === v.classId), [classes, v.classId]);

  function setParent(i: number, patch: Partial<Parent>) {
    setV((s) => ({ ...s, parents: s.parents.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "add") {
      const res = await run(
        () =>
          api<AddResult>("/students", {
            body: {
              name: v.name,
              guardianName: v.guardianName,
              gender: v.gender,
              dob: v.dob || null,
              address: v.address || null,
              notes: v.notes || null,
              admissionDate: v.admissionDate,
              classId: v.classId,
              rollNo: v.rollNo || null,
              excludedClassSubjectIds: v.excluded,
              parents: v.parents.filter((p) => p.phone.trim()).map((p) => ({ phone: p.phone, name: p.name || null, relation: p.relation })),
            },
          }),
        { success: "Student added", refresh: false },
      );
      if (!res) return;
      const newLinks = res.parents.filter((p) => p.setupLink);
      if (newLinks.length) {
        setCreatedId(res.id);
        setLinks(newLinks);
      } else router.push(`/students/${res.id}?added=1`);
    } else {
      const res = await run(
        () =>
          api(`/students/${studentId}`, {
            method: "PATCH",
            body: {
              name: v.name,
              guardianName: v.guardianName,
              gender: v.gender,
              dob: v.dob || null,
              address: v.address || null,
              notes: v.notes || null,
              admissionDate: v.admissionDate,
              rollNo: v.rollNo,
              excludedClassSubjectIds: v.excluded,
            },
          }),
        { success: "Changes saved" },
      );
      if (res !== undefined) router.push(`/students/${studentId}`);
    }
  }

  const err = (k: string) => fields[k];

  return (
    <form onSubmit={submit} className="space-y-4 pb-24 lg:pb-0" noValidate>
      <Card>
        <CardHeader title="Student" />
        <CardBody className="space-y-4">
          <Field label="Full name" required error={err("name")}>
            {(p) => <Input {...p} value={v.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" autoFocus={mode === "add"} />}
          </Field>
          <Field label="Father's / guardian's name" required error={err("guardianName")}>
            {(p) => <Input {...p} value={v.guardianName} onChange={(e) => set("guardianName", e.target.value)} autoComplete="off" />}
          </Field>
          <Field label="Gender" required>
            {() => (
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Gender">
                {(["male", "female", "other"] as const).map((g) => (
                  <Chip key={g} on={v.gender === g} onClick={() => set("gender", g)} role="radio">
                    {g === "male" ? "Boy" : g === "female" ? "Girl" : "Other"}
                  </Chip>
                ))}
              </div>
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date of birth" optional error={err("dob")}>
              {(p) => <Input {...p} type="date" value={v.dob} max={today} onChange={(e) => set("dob", e.target.value)} />}
            </Field>
            <Field label="Admission date" required error={err("admissionDate")}>
              {(p) => <Input {...p} type="date" value={v.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} />}
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Class" description={mode === "edit" ? "To change class, use “Move class” on the profile." : undefined} />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
            <Field label="Class" required error={err("classId")}>
              {(p) => (
                <Select
                  {...p}
                  value={v.classId}
                  disabled={mode === "edit"}
                  onChange={(e) => setV((s) => ({ ...s, classId: e.target.value, excluded: [], rollNo: "" }))}
                >
                  <option value="">Choose class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Roll no." error={err("rollNo")} hint={mode === "add" && cls ? `Next free: ${cls.nextRoll}` : undefined}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="numeric"
                  value={v.rollNo}
                  placeholder={mode === "add" ? cls?.nextRoll ?? "" : ""}
                  onChange={(e) => set("rollNo", e.target.value)}
                />
              )}
            </Field>
          </div>
          {cls && cls.subjects.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Subjects</legend>
              <p className="mb-2 text-[13px] text-muted">Takes all by default — tap to remove a subject the student doesn't take.</p>
              <div className="flex flex-wrap gap-2">
                {cls.subjects.map((s) => {
                  const on = !v.excluded.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("excluded", on ? [...v.excluded, s.id] : v.excluded.filter((x) => x !== s.id))}
                      className={cn(
                        "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                        on ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface text-muted line-through",
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
        </CardBody>
      </Card>

      {mode === "add" && (
        <Card>
          <CardHeader
            title="Parents"
            description="A parent who already has a child here is linked automatically — no duplicate account."
          />
          <CardBody className="space-y-4">
            {v.parents.map((p, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-border bg-surface-2/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <UserRound className="size-4 text-muted" aria-hidden /> Parent {i + 1}
                  </p>
                  {i > 0 && (
                    <Button variant="ghost" size="icon-sm" aria-label="Remove parent" onClick={() => setV((s) => ({ ...s, parents: s.parents.filter((_, j) => j !== i) }))}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Parent ${i + 1} relation`}>
                  {RELATIONS.map((r) => (
                    <Chip key={r.v} on={p.relation === r.v} onClick={() => setParent(i, { relation: r.v })} role="radio">
                      {r.l}
                    </Chip>
                  ))}
                </div>
                <Field label="Mobile number" required error={err(`parents.${i}.phone`)}>
                  {(fp) => (
                    <Input {...fp} type="tel" inputMode="tel" placeholder="0300 1234567" value={p.phone} onChange={(e) => setParent(i, { phone: e.target.value })} />
                  )}
                </Field>
                <Field label="Name" optional hint={i === 0 ? "Defaults to the guardian's name" : undefined}>
                  {(fp) => <Input {...fp} value={p.name} onChange={(e) => setParent(i, { name: e.target.value })} autoComplete="off" />}
                </Field>
              </div>
            ))}
            {v.parents.length < 2 && (
              <Button variant="soft" size="sm" onClick={() => setV((s) => ({ ...s, parents: [...s.parents, { phone: "", name: "", relation: "mother" }] }))}>
                <Plus aria-hidden /> Add second parent
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="More details" />
        <CardBody className="space-y-4">
          <Field label="Address" optional error={err("address")}>
            {(p) => <Input {...p} value={v.address} onChange={(e) => set("address", e.target.value)} />}
          </Field>
          <Field label="Notes" optional hint="Visible to admins only" error={err("notes")}>
            {(p) => <Textarea {...p} value={v.notes} onChange={(e) => set("notes", e.target.value)} />}
          </Field>
        </CardBody>
      </Card>

      <StickyActions>
        <Button variant="secondary" onClick={() => router.back()} className="flex-1 lg:flex-none">Cancel</Button>
        <Button type="submit" loading={busy} className="flex-[2] lg:flex-none">{mode === "add" ? "Add student" : "Save changes"}</Button>
      </StickyActions>

      {links.length > 0 && (
        <SetupLinkSheet
          info={links[0]!}
          academyName={academyName}
          onClose={() => {
            const rest = links.slice(1);
            setLinks(rest);
            if (!rest.length && createdId) router.push(`/students/${createdId}?added=1`);
          }}
        />
      )}
    </form>
  );
}

function Chip({ on, onClick, children, role }: { on: boolean; onClick: () => void; children: React.ReactNode; role?: string }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === "radio" ? on : undefined}
      onClick={onClick}
      className={cn(
        "h-11 rounded-lg border text-sm font-medium transition-colors",
        on ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
