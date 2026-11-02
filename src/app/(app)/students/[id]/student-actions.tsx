"use client";

import { ArrowRightLeft, Link2, MoreVertical, Pencil, RotateCcw, Trash2, UserMinus, UserPlus } from "lucide-react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SetupLinkSheet, type SetupLinkInfo } from "@/components/setup-link-sheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMonth } from "@/lib/format";
import { useMutation } from "@/lib/use-mutation";

type ClassOpt = { id: string; name: string };

const REASONS = [
  { v: "left", l: "Left" },
  { v: "completed", l: "Completed" },
  { v: "transferred", l: "Transferred" },
  { v: "expelled", l: "Expelled" },
  { v: "other", l: "Other" },
] as const;

export function StudentActions({
  id,
  name,
  status,
  currentClassId,
  classes,
  today,
  canDelete,
  academyName,
}: {
  id: string;
  name: string;
  status: "active" | "removed";
  currentClassId: string | null;
  classes: ClassOpt[];
  today: string;
  canDelete: boolean;
  academyName: string;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<null | "move" | "remove" | "readmit" | "delete" | "parent">(null);
  const [link, setLink] = useState<SetupLinkInfo | null>(null);
  const close = () => setSheet(null);

  return (
    <>
      <div className="flex items-center gap-2">
        {status === "active" ? (
          <>
            <ButtonLink href={`/students/${id}/edit`} variant="secondary" size="sm">
              <Pencil aria-hidden /> Edit
            </ButtonLink>
            <Button variant="secondary" size="sm" onClick={() => setSheet("move")}>
              <ArrowRightLeft aria-hidden /> <span className="hidden sm:inline">Move class</span><span className="sm:hidden">Move</span>
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => setSheet("readmit")}>
            <RotateCcw aria-hidden /> Re-admit
          </Button>
        )}
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button variant="secondary" size="icon-sm" aria-label="More actions">
              <MoreVertical />
            </Button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl border border-border bg-surface p-1.5 shadow-raised data-[state=open]:animate-fade-in">
              <MenuItem icon={UserPlus} onSelect={() => setSheet("parent")}>Link a parent</MenuItem>
              {status === "active" && (
                <MenuItem icon={UserMinus} danger onSelect={() => setSheet("remove")}>Remove student</MenuItem>
              )}
              {canDelete && (
                <MenuItem icon={Trash2} danger onSelect={() => setSheet("delete")}>Delete permanently</MenuItem>
              )}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>

      {sheet === "move" && <MoveSheet id={id} name={name} classes={classes.filter((c) => c.id !== currentClassId)} today={today} onClose={close} />}
      {sheet === "readmit" && <MoveSheet id={id} name={name} classes={classes} today={today} onClose={close} readmit />}
      {sheet === "remove" && <RemoveSheet id={id} name={name} today={today} onClose={close} />}
      {sheet === "delete" && <DeleteSheet id={id} name={name} onClose={close} onDone={() => router.replace("/students")} />}
      {sheet === "parent" && (
        <ParentSheet
          id={id}
          onClose={close}
          onLinked={(info) => {
            close();
            if (info.setupLink) setLink(info);
          }}
        />
      )}
      <SetupLinkSheet info={link} academyName={academyName} onClose={() => setLink(null)} />
    </>
  );
}

function MenuItem({ icon: Icon, children, onSelect, danger }: { icon: typeof Pencil; children: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn(
        "flex h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm font-medium outline-none data-[highlighted]:bg-surface-2",
        danger && "text-danger-fg data-[highlighted]:bg-danger-soft",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </Menu.Item>
  );
}

function MoveSheet({ id, name, classes, today, onClose, readmit }: { id: string; name: string; classes: ClassOpt[]; today: string; onClose: () => void; readmit?: boolean }) {
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(today);
  const [rollNo, setRollNo] = useState("");
  const { run, busy, fields } = useMutation();
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={readmit ? `Re-admit ${name}` : `Move ${name}`}
      description={readmit ? "Keeps the same registration number and all history." : "Old attendance, results and fees stay in history. The new class's teachers see the student from the chosen date."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!classId}
            loading={busy}
            onClick={async () => {
              const res = await run(() => api(`/students/${id}/${readmit ? "readmit" : "move"}`, { body: { classId, date, rollNo: rollNo || null } }), {
                success: readmit ? "Student re-admitted" : "Student moved",
              });
              if (res !== undefined) onClose();
            }}
          >
            {readmit ? "Re-admit" : "Move"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={readmit ? "Class" : "New class"} required error={fields.classId}>
          {(p) => (
            <Select {...p} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Choose class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From date" required error={fields.date}>
            {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Roll no." optional error={fields.rollNo} hint="Auto if empty">
            {(p) => <Input {...p} inputMode="numeric" value={rollNo} onChange={(e) => setRollNo(e.target.value)} />}
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

function RemoveSheet({ id, name, today, onClose }: { id: string; name: string; today: string; onClose: () => void }) {
  const [reason, setReason] = useState<(typeof REASONS)[number]["v"]>("left");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today);
  const [unpaid, setUnpaid] = useState<string[] | null>(null);
  const { run, busy, fields } = useMutation();
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={unpaid ? `${name} removed` : `Remove ${name}?`}
      description={
        unpaid
          ? undefined
          : "They leave fee lists from next month. History stays. Parents keep read-only access for 30 days."
      }
      footer={
        unpaid ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                const res = await run(() => api<{ unpaidMonths: string[] }>(`/students/${id}/remove`, { body: { reason, note: note || null, date } }), {
                  success: "Student removed",
                });
                if (res) setUnpaid(res.unpaidMonths);
              }}
            >
              Remove student
            </Button>
          </>
        )
      }
    >
      {unpaid ? (
        unpaid.length ? (
          <Notice tone="warning" title={`${unpaid.length} month${unpaid.length === 1 ? "" : "s"} unpaid`}>
            {unpaid.map((m) => formatMonth(m)).join(", ")} — shown to the owner on the Finance screen.
          </Notice>
        ) : (
          <Notice tone="success">No unpaid months. All history is kept.</Notice>
        )
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Reason</legend>
            <div className="grid grid-cols-3 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.v}
                  type="button"
                  aria-pressed={reason === r.v}
                  onClick={() => setReason(r.v)}
                  className={cn(
                    "h-11 rounded-lg border text-sm font-medium",
                    reason === r.v ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  {r.l}
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Leaving date" required error={fields.date}>
            {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Note" optional={reason !== "other"} required={reason === "other"} error={fields.note}>
            {(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
      )}
    </Sheet>
  );
}

function DeleteSheet({ id, name, onClose, onDone }: { id: string; name: string; onClose: () => void; onDone: () => void }) {
  const [confirm, setConfirm] = useState("");
  const { run, busy, fields } = useMutation();
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Delete permanently?"
      description="Only for a student added by mistake with no marks or fee payments. This cannot be undone."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={confirm.trim().toLowerCase() !== name.trim().toLowerCase()}
            onClick={async () => {
              const res = await run(() => api(`/students/${id}`, { method: "DELETE", body: { confirmName: confirm } }), { success: "Student deleted", refresh: false });
              if (res !== undefined) onDone();
            }}
          >
            Delete
          </Button>
        </>
      }
    >
      <Field label={`Type “${name}” to confirm`} error={fields.confirmName}>
        {(p) => <Input {...p} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />}
      </Field>
    </Sheet>
  );
}

function ParentSheet({ id, onClose, onLinked }: { id: string; onClose: () => void; onLinked: (i: SetupLinkInfo) => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<"father" | "mother" | "guardian">("mother");
  const { run, busy, fields } = useMutation();
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Link a parent"
      description="Up to 2 parent accounts per student. An existing account with this number is reused."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={busy}
            onClick={async () => {
              const res = await run(() => api<SetupLinkInfo>(`/students/${id}/parents`, { body: { phone, name: name || null, relation } }), { success: "Parent linked" });
              if (res) onLinked(res);
            }}
          >
            Link parent
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(["father", "mother", "guardian"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={relation === r}
              onClick={() => setRelation(r)}
              className={cn(
                "h-11 rounded-lg border text-sm font-medium capitalize",
                relation === r ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Field label="Mobile number" required error={fields.phone}>
          {(p) => <Input {...p} type="tel" inputMode="tel" placeholder="0300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
        <Field label="Name" optional>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
      </div>
    </Sheet>
  );
}

export function ParentRowActions({ studentId, parentId, name, phone, invited, academyName, canUnlink }: { studentId: string; parentId: string; name: string; phone: string; invited: boolean; academyName: string; canUnlink: boolean }) {
  const [link, setLink] = useState<SetupLinkInfo | null>(null);
  const { run, busy } = useMutation();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={invited ? "Resend setup link" : "New setup link (password reset)"}
        loading={busy}
        onClick={async () => {
          const res = await run(() => api<{ setupLink: string }>(`/users/${parentId}/setup-link`, { body: { role: "parent" } }), { refresh: false });
          if (res) setLink({ name, phone, setupLink: res.setupLink });
        }}
      >
        {!busy && <Link2 />}
      </Button>
      {canUnlink && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Unlink parent"
          onClick={() => run(() => api(`/students/${studentId}/parents`, { method: "DELETE", body: { parentUserId: parentId } }), { success: "Parent unlinked" })}
        >
          <UserMinus />
        </Button>
      )}
      <SetupLinkSheet info={link} academyName={academyName} onClose={() => setLink(null)} />
    </div>
  );
}
