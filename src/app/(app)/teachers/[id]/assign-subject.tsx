"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useMutation } from "@/lib/use-mutation";
import type { teacherAssignmentOptions } from "@/server/modules/org";

type Props = Awaited<ReturnType<typeof teacherAssignmentOptions>> & { teacherId: string; teacherName: string };

export function AssignSubject(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="soft" className="min-h-12" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Assign subject
      </Button>
      {open && <AssignmentSheet {...props} close={() => setOpen(false)} />}
    </>
  );
}

function AssignmentSheet({ teacherId, teacherName, classes, subjects, assignments, close }: Props & { close: () => void }) {
  const [classId, setClassId] = useState(classes.length === 1 ? classes[0]!.id : "");
  const [subjectId, setSubjectId] = useState("");
  const { run, busy } = useMutation();
  const classAssignments = assignments.filter((assignment) => assignment.classId === classId);
  const current = classAssignments.find((assignment) => assignment.subjectId === subjectId);
  const alreadyAssigned = current?.teacherId === teacherId;
  const replacing = Boolean(current?.teacherId && !alreadyAssigned);

  return (
    <Sheet
      open
      onOpenChange={(open) => { if (!open && !busy) close(); }}
      title={`Assign a subject to ${teacherName}`}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={close}>Cancel</Button>
          <Button type="submit" form="assign-teacher-subject" disabled={!classId || !subjectId || alreadyAssigned} loading={busy}>
            {replacing ? "Replace teacher" : "Assign subject"}
          </Button>
        </>
      }
    >
      <form id="assign-teacher-subject" className="space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        if (!classId || !subjectId || alreadyAssigned) return;
        const result = await run(() => api(`/teachers/${teacherId}/assignments`, {
          body: { classId, subjectId, previousTeacherId: current?.teacherId ?? null },
        }), { success: "Teaching assignment saved" });
        if (result !== undefined) close();
      }}>
        <Field label="Class" required>
          {(props) => <Select {...props} required value={classId} onChange={(event) => {
            setClassId(event.target.value);
            setSubjectId("");
          }}>
            <option value="">Choose a class</option>
            {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}{cls.shift ? ` · ${cls.shift}` : ""}</option>)}
          </Select>}
        </Field>
        <Field label="Subject" required>
          {(props) => <Select {...props} required disabled={!classId} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            <option value="">Choose a subject</option>
            {subjects.map((subject) => {
              const existing = classAssignments.find((assignment) => assignment.subjectId === subject.id);
              return <option key={subject.id} value={subject.id} disabled={existing?.teacherId === teacherId}>{subject.name}{existing?.teacherId === teacherId ? " (already assigned)" : ""}</option>;
            })}
          </Select>}
        </Field>
        {replacing && <Notice tone="warning">This subject is currently taught by {current?.teacherName ?? "another teacher"}. Saving replaces their current assignment and keeps past teaching records.</Notice>}
        {subjectId && !current && <p className="text-sm text-muted">This subject will also be added to the class.</p>}
      </form>
    </Sheet>
  );
}
