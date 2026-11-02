"use client";

import { Check, Megaphone, MoreHorizontal, Pin, PinOff, Trash2 } from "lucide-react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/data";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { useMutation } from "@/lib/use-mutation";

type Audience = "all" | "parents" | "teachers" | "classes";
type A = { id: string; title: string; body: string; audienceType: Audience; classNames: string[]; pinned: boolean; publishedAt: string; authorName: string; authorId: string };

const AUD_LABEL: Record<Audience, string> = { all: "Everyone", parents: "All parents", teachers: "All teachers", classes: "Classes" };

export function AnnouncementFeed({ items, me, isStaff }: { items: A[]; me: string; isStaff: boolean }) {
  const { run } = useMutation();
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} id={`a-${a.id}`} className="scroll-mt-20">
          <Card className={cn("p-4", a.pinned && "border-primary/40 bg-primary-soft/25")}>
            <div className="flex items-start gap-3">
              <Avatar name={a.authorName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{a.authorName}</p>
                  <span className="text-xs text-muted">{formatRelative(a.publishedAt)}</span>
                  {a.pinned && <Badge tone="primary" icon={Pin}>Pinned</Badge>}
                </div>
                <p className="mt-1.5 text-[17px] font-semibold leading-6">{a.title}</p>
                <p className="mt-1 whitespace-pre-line text-[15px] leading-6 text-fg/90">{a.body}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.audienceType === "classes" ? a.classNames.map((c) => <Badge key={c}>{c}</Badge>) : <Badge>{AUD_LABEL[a.audienceType]}</Badge>}
                </div>
              </div>
              {(isStaff || a.authorId === me) && (
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Announcement options">
                      <MoreHorizontal />
                    </Button>
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Content align="end" sideOffset={6} className="z-50 min-w-44 rounded-xl border border-border bg-surface p-1.5 shadow-raised">
                      {isStaff && (
                        <Menu.Item onSelect={() => run(() => api(`/announcements/${a.id}`, { method: "PATCH", body: { pinned: !a.pinned } }))} className="flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-surface-2">
                          {a.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} {a.pinned ? "Unpin" : "Pin to top"}
                        </Menu.Item>
                      )}
                      <Menu.Item onSelect={() => run(() => api(`/announcements/${a.id}`, { method: "DELETE" }), { success: "Announcement deleted" })} className="flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-danger-fg outline-none data-[highlighted]:bg-danger-soft">
                        <Trash2 className="size-4" /> Delete
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu.Root>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function ComposeButton({ classes, teacherOnly }: { classes: { id: string; name: string }[]; teacherOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [aud, setAud] = useState<Audience>(teacherOnly ? "classes" : "all");
  const [cls, setCls] = useState<string[]>(teacherOnly && classes.length === 1 ? [classes[0]!.id] : []);
  const [pinned, setPinned] = useState(false);
  const { run, busy, fields } = useMutation();
  const audiences: Audience[] = teacherOnly ? ["classes"] : ["all", "parents", "teachers", "classes"];

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Megaphone aria-hidden /> <span className="hidden sm:inline">New announcement</span><span className="sm:hidden">New</span>
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="New announcement"
        description="Everyone in the audience gets an in-app notification and a push."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                const r = await run(() => api<{ recipients: number }>("/announcements", { body: { title, body, audienceType: aud, classIds: aud === "classes" ? cls : [], pinned } }), {
                  success: "Announcement posted",
                });
                if (r) {
                  setOpen(false);
                  setTitle("");
                  setBody("");
                }
              }}
            >
              Post
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Send to</legend>
            <div className="grid grid-cols-2 gap-2">
              {audiences.map((a) => (
                <button key={a} type="button" aria-pressed={aud === a} onClick={() => setAud(a)} className={cn("h-11 rounded-lg border text-sm font-medium", aud === a ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface hover:bg-surface-2")}>
                  {a === "classes" ? (teacherOnly ? "My classes" : "Specific classes") : AUD_LABEL[a]}
                </button>
              ))}
            </div>
          </fieldset>
          {aud === "classes" && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Classes <span className="text-xs font-normal text-muted">— parents of these classes</span></legend>
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => {
                  const on = cls.includes(c.id);
                  return (
                    <button key={c.id} type="button" aria-pressed={on} onClick={() => setCls((x) => (on ? x.filter((y) => y !== c.id) : [...x, c.id]))} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium", on ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface")}>
                      {on && <Check className="size-4" aria-hidden />} {c.name}
                    </button>
                  );
                })}
              </div>
              {fields.classIds && <p className="mt-1.5 text-[13px] font-medium text-danger-fg">{fields.classIds}</p>}
            </fieldset>
          )}
          <Field label="Title" required error={fields.title}>{(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />}</Field>
          <Field label="Message" required error={fields.body}>{(p) => <Textarea {...p} rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} />}</Field>
          {!teacherOnly && (
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin to the top
            </label>
          )}
        </div>
      </Sheet>
    </>
  );
}
