"use client";

import { LockOpen, MessageSquareWarning, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useMutation } from "@/lib/use-mutation";

export function UnlockButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, busy, fields } = useMutation();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <LockOpen aria-hidden /> Unlock to correct
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title="Unlock for correction?"
        description="The teacher (or you) can edit marks, then republish. Parents whose child's marks change see “Corrected”. Old and new values are logged."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              loading={busy}
              disabled={reason.trim().length < 3}
              onClick={async () => {
                const r = await run(() => api(`/assessments/${id}/unlock`, { body: { reason } }), { success: "Unlocked for correction" });
                if (r !== undefined) setOpen(false);
              }}
            >
              Unlock
            </Button>
          </>
        }
      >
        <Field label="Reason" required error={fields.reason}>
          {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ali's marks entered wrongly" autoFocus />}
        </Field>
      </Sheet>
    </>
  );
}

export function RequestCorrectionButton({ id, requested }: { id: string; requested: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const { run, busy } = useMutation();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} disabled={requested}>
        <MessageSquareWarning aria-hidden /> {requested ? "Correction requested" : "Request correction"}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title="Request a correction"
        description="The office is notified and can unlock the test for you."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                const r = await run(() => api(`/assessments/${id}/correction-request`, { body: { note } }), { success: "Request sent to the office" });
                if (r !== undefined) setOpen(false);
              }}
            >
              Send request
            </Button>
          </>
        }
      >
        <Field label="What needs fixing?" optional>
          {(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </Sheet>
    </>
  );
}

export function DeleteDraftButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, busy } = useMutation();
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Delete draft" onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title="Delete this draft test?"
        description="Any marks entered so far are deleted. Published tests can't be deleted."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                const r = await run(() => api(`/assessments/${id}`, { method: "DELETE" }), { success: "Draft deleted", refresh: false });
                if (r !== undefined) router.replace("/results");
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}
