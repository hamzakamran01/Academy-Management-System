"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { StickyActions } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { AcademySettings } from "@/lib/settings";
import { useMutation } from "@/lib/use-mutation";


/** FR-ADM-03 / FR-ORG-01 — Super Admin settings. */
export function SettingsForm({ initial }: { initial: { name: string; address: string | null; phone: string | null; settings: AcademySettings } }) {
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [s, setS] = useState<AcademySettings>(initial.settings);
  const { run, busy, fields } = useMutation();
  const set = <K extends keyof AcademySettings>(k: K, v: AcademySettings[K]) => setS((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <Card>
        <CardHeader title="Academy profile" />
        <CardBody className="space-y-4">
          <Field label="Academy name" required error={fields.name}>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Address" optional>{(p) => <Input {...p} value={address} onChange={(e) => setAddress(e.target.value)} />}</Field>
          <Field label="Phone" optional>{(p) => <Input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
          <Field label="Registration number prefix" hint={`New students get numbers like ${s.registrationPrefix}-26-0042`} error={fields["settings.registrationPrefix"]}>
            {(p) => <Input {...p} value={s.registrationPrefix} maxLength={5} onChange={(e) => set("registrationPrefix", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} />}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Results" />
        <CardBody className="space-y-4">
          <Field label="Pass mark (%)">{(p) => <Input {...p} type="number" min={0} max={100} value={s.passPercent} onChange={(e) => set("passPercent", Number(e.target.value))} />}</Field>
          <div>
            <p className="mb-2 text-sm font-medium">Grade scale</p>
            <ul className="space-y-2">
              {s.gradeScale.map((g, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Input aria-label="Grade" value={g.grade} maxLength={4} className="h-10 w-20 text-center font-semibold" onChange={(e) => set("gradeScale", s.gradeScale.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} />
                  <span className="text-sm text-muted">from</span>
                  <Input aria-label="Minimum percent" type="number" min={0} max={100} value={g.minPercent} className="h-10 w-24" onChange={(e) => set("gradeScale", s.gradeScale.map((x, j) => (j === i ? { ...x, minPercent: Number(e.target.value) } : x)))} />
                  <span className="text-sm text-muted">%</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove grade" onClick={() => set("gradeScale", s.gradeScale.filter((_, j) => j !== i))} disabled={s.gradeScale.length <= 1}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <Button variant="soft" size="sm" className="mt-2" onClick={() => set("gradeScale", [...s.gradeScale, { grade: "", minPercent: 0 }])}>
              <Plus aria-hidden /> Add grade
            </Button>
          </div>
          <Toggle label="Show class average to parents" on={s.showClassAverageToParents} onChange={(v) => set("showClassAverageToParents", v)} />
          <Toggle label="Show position in class to parents" on={s.showPositionToParents} onChange={(v) => set("showPositionToParents", v)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Daily teaching log" description="Teachers get a reminder if a class hasn't been logged by this time" />
        <CardBody>
          <Field label="Reminder time">{(p) => <Input {...p} type="time" className="max-w-40" value={s.lessonLogReminderTime} onChange={(e) => set("lessonLogReminderTime", e.target.value)} />}</Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Fees" />
        <CardBody className="space-y-4">
          <Toggle label="Create a fee row when a student joins mid-month" on={s.feeRowOnJoin} onChange={(v) => set("feeRowOnJoin", v)} />
          <Toggle label="Notify parents when a fee is marked Paid" on={s.notifyParentOnPaid} onChange={(v) => set("notifyParentOnPaid", v)} />
          <Toggle label="Monthly fee reminder to parents of unpaid students" on={s.feeReminderEnabled} onChange={(v) => set("feeReminderEnabled", v)} />
          {s.feeReminderEnabled && (
            <Field label="Reminder day of month" hint="Sent at 10:00">{(p) => <Input {...p} type="number" min={1} max={28} value={s.feeReminderDay} onChange={(e) => set("feeReminderDay", Number(e.target.value))} />}</Field>
          )}
        </CardBody>
      </Card>

      <StickyActions>
        <Button
          size="lg"
          loading={busy}
          className="flex-1 lg:flex-none"
          onClick={() => run(() => api("/settings", { method: "PUT", body: { name, address: address || null, phone: phone || null, settings: s } }), { success: "Settings saved" })}
        >
          <Save aria-hidden /> Save settings
        </Button>
      </StickyActions>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-border-strong")}>
        <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow-xs transition-[inset-inline-start]", on ? "start-[22px]" : "start-0.5")} />
      </button>
    </label>
  );
}
