"use client";

import { Archive, BookOpen, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListCard, ListRow } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useMutation } from "@/lib/use-mutation";

type Subject = { id: string; name: string; code: string | null; classCount: number };

export function SubjectsClient({ subjects }: { subjects: Subject[] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [archiving, setArchiving] = useState<Subject | null>(null);
  const { run, busy, fields } = useMutation();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() => api("/subjects", { body: { name, code: code || null } }), { success: "Subject added" });
    if (res !== undefined) {
      setName("");
      setCode("");
      setAdding(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Add subject
        </Button>
      </div>
      {subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects yet" description="Create the academy's subject list once, then attach subjects to classes." />
      ) : (
        <ListCard>
          {subjects.map((s) => (
            <ListRow
              key={s.id}
              leading={
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-sm font-bold text-primary-soft-fg">
                  {(s.code ?? s.name).slice(0, 3).toUpperCase()}
                </span>
              }
              title={s.name}
              subtitle={`Taught in ${s.classCount} class${s.classCount === 1 ? "" : "es"}`}
              trailing={
                <Button variant="ghost" size="icon-sm" aria-label={`Archive ${s.name}`} onClick={() => setArchiving(s)}>
                  <Archive />
                </Button>
              }
            />
          ))}
        </ListCard>
      )}

      <Sheet
        open={adding}
        onOpenChange={setAdding}
        title="Add subject"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" form="subject-form" loading={busy}>Add subject</Button>
          </>
        }
      >
        <form id="subject-form" onSubmit={add} className="space-y-4">
          <Field label="Subject name" required error={fields.name}>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Physics" autoFocus />}
          </Field>
          <Field label="Short code" optional error={fields.code}>
            {(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. PHY" maxLength={12} />}
          </Field>
        </form>
      </Sheet>

      <Sheet
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        size="sm"
        title={`Archive ${archiving?.name}?`}
        description="It disappears from pickers for new classes. Classes already teaching it are not affected."
        footer={
          <>
            <Button variant="secondary" onClick={() => setArchiving(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                await run(() => api(`/subjects/${archiving!.id}`, { method: "PATCH", body: { archived: true } }), { success: "Subject archived" });
                setArchiving(null);
              }}
            >
              Archive
            </Button>
          </>
        }
      />
    </>
  );
}
