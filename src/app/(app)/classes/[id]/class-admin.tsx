"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api, ApiClientError } from "@/lib/api";
import { useMutation } from "@/lib/use-mutation";
import { ClassFormSheet, type ClassValues, type Option } from "../class-form";

export function EditClassButton({ values, teachers }: { values: ClassValues; teachers: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="icon" onClick={() => setOpen(true)} aria-label="Edit class">
        <Pencil />
      </Button>
      {open && <ClassFormSheet initial={values} teachers={teachers} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Inline teacher picker on each class-subject row (FR-ORG-06). */
export function TeacherPicker({ classSubjectId, teacherId, teachers }: { classSubjectId: string; teacherId: string | null; teachers: Option[] }) {
  const { run, busy } = useMutation();
  return (
    <Select
      aria-label="Subject teacher"
      className="h-10 min-w-40 text-sm"
      disabled={busy}
      value={teacherId ?? ""}
      onChange={(e) =>
        run(() => api(`/class-subjects/${classSubjectId}/teacher`, { method: "PUT", body: { teacherId: e.target.value || null } }), {
          success: "Teacher updated",
        })
      }
    >
      <option value="">Not assigned</option>
      {teachers.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </Select>
  );
}

export function SubjectRowMenu({ classSubjectId, name }: { classSubjectId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const { run, busy } = useMutation();
  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={`Options for ${name}`}>
        <MoreHorizontal />
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={`Remove ${name} from this class?`}
        description="Students' past results and syllabus progress for this subject stay in history."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                await run(() => api(`/class-subjects/${classSubjectId}`, { method: "DELETE" }), { success: `${name} removed` });
                setOpen(false);
              }}
            >
              Remove subject
            </Button>
          </>
        }
      />
    </>
  );
}

export function AddSubjectButton({ classId, subjects, teachers }: { classId: string; subjects: Option[]; teachers: Option[] }) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const { run, busy } = useMutation();
  return (
    <>
      <Button variant="soft" size="sm" onClick={() => setOpen(true)} disabled={!subjects.length}>
        <Plus aria-hidden /> Add subject
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Add subject to class"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!subjectId}
              loading={busy}
              onClick={async () => {
                const ok = await run(() => api(`/classes/${classId}/subjects`, { body: { subjectId, teacherId: teacherId || null } }), {
                  success: "Subject added",
                });
                if (ok !== undefined) {
                  setOpen(false);
                  setSubjectId("");
                  setTeacherId("");
                }
              }}
            >
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Subject" required>
            {(p) => (
              <Select {...p} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Choose a subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Teacher" optional>
            {(p) => (
              <Select {...p} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">Assign later</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <p className="text-sm text-muted">
            Missing a subject? <a href="/subjects" className="font-medium text-primary hover:underline">Manage subjects</a>
          </p>
        </div>
      </Sheet>
    </>
  );
}

/** FR-ORG-07: removal blocked while students remain — offer "Move students". */
export function RemoveClassButton({ classId, name, studentCount }: { classId: string; name: string; studentCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<number | null>(null);
  const { run, busy } = useMutation();
  const count = blocked ?? studentCount;
  return (
    <>
      <Button variant="danger-soft" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden /> Remove class
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={count > 0 ? "Move students first" : `Remove ${name}?`}
        description={
          count > 0
            ? undefined
            : "The class is archived. Its results, teaching and fee history stay available in reports."
        }
        footer={
          count > 0 ? (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
              <ButtonLink href={`/students?classId=${classId}&move=1`}>Move students</ButtonLink>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={async () => {
                  try {
                    await api(`/classes/${classId}/archive`, { body: {} });
                    router.replace("/classes");
                    router.refresh();
                  } catch (err) {
                    if (err instanceof ApiClientError && err.code === "CLASS_HAS_STUDENTS") setBlocked(Number(err.details?.count ?? 1));
                    else await run(() => Promise.reject(err));
                  }
                }}
              >
                Remove class
              </Button>
            </>
          )
        }
      >
        {count > 0 && (
          <Notice tone="warning">
            {count} student{count === 1 ? " is" : "s are"} still in this class — move them to another class before removing it.
          </Notice>
        )}
      </Sheet>
    </>
  );
}
