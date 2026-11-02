"use client";

import { Check, Copy, CornerDownRight, MessageSquare, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TopicStatusIcon } from "@/components/progress-bits";
import { StickyActions } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useMutation } from "@/lib/use-mutation";

type Tree = { id: string; title: string; chapters: { id: string; title: string; topics: { id: string; title: string; size: number; status: "not_started" | "started" | "completed" }[] }[] }[];

export function PlanEditor({
  csId,
  week,
  planId,
  submitted,
  initialTopics,
  initialNote,
  carryForward,
  tree,
  canEdit,
  canComment,
  comments,
  copyTargets,
}: {
  csId: string;
  week: string;
  planId: string | null;
  submitted: boolean;
  initialTopics: string[];
  initialNote: string;
  carryForward: string[];
  tree: Tree;
  canEdit: boolean;
  canComment: boolean;
  comments: { id: string; text: string; at: string; authorName: string }[];
  copyTargets: { id: string; className: string }[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set(initialTopics));
  const [note, setNote] = useState(initialNote);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "submit">(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const titles = useMemo(() => new Map(tree.flatMap((b) => b.chapters.flatMap((c) => c.topics.map((t) => [t.id, t.title] as const)))), [tree]);
  const carry = carryForward.filter((id) => !picked.has(id));
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function save(submit: boolean) {
    setBusy(submit ? "submit" : "save");
    try {
      await api("/weekly-plans", { method: "PUT", body: { classSubjectId: csId, week, topicIds: [...picked], note: note || null, submit } });
      toast.success(submit ? "Plan submitted" : "Draft saved");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      {canEdit && carry.length > 0 && (
        <Notice tone="info" icon={CornerDownRight} title={`${carry.length} unfinished topic${carry.length === 1 ? "" : "s"} from last week`}>
          <p>{carry.map((id) => titles.get(id)).join(", ")}</p>
          <Button size="sm" variant="soft" className="mt-2" onClick={() => setPicked((p) => new Set([...p, ...carry]))}>
            Carry forward
          </Button>
        </Notice>
      )}

      <Card>
        <CardHeader
          title="Topics this week"
          description={`${picked.size} selected`}
          action={
            <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setShowDone((s) => !s)}>
              {showDone ? "Hide completed" : "Show completed"}
            </button>
          }
        />
        <div className="border-t border-border">
          {tree.flatMap((b) => b.chapters).map((c) => {
            const visible = c.topics.filter((t) => showDone || t.status !== "completed" || picked.has(t.id));
            if (!visible.length) return null;
            return (
              <div key={c.id}>
                <p className="bg-surface-2 px-4 py-2 text-xs font-semibold text-muted">{c.title}</p>
                <ul>
                  {visible.map((t) => {
                    const on = picked.has(t.id);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          disabled={!canEdit}
                          aria-pressed={on}
                          onClick={() => toggle(t.id)}
                          className="flex min-h-14 w-full items-center gap-3 border-b border-border px-4 py-2.5 text-start last:border-b-0 hover:bg-surface-2 disabled:cursor-default"
                        >
                          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border-2", on ? "border-primary bg-primary text-primary-fg" : "border-border-strong")}>
                            {on && <Check className="size-4" strokeWidth={3} aria-hidden />}
                          </span>
                          <span className="min-w-0 flex-1 text-[15px]">{t.title}</span>
                          {t.size > 1 && <Badge>{t.size}p</Badge>}
                          <TopicStatusIcon status={t.status} className="size-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardBody className="pt-4">
          <Field label="Note for the week" optional>
            {(p) => <Textarea {...p} rows={2} value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Practical on Thursday" />}
          </Field>
        </CardBody>
      </Card>

      <Comments planId={planId} comments={comments} canComment={canComment} />

      {canEdit && (
        <StickyActions>
          {planId && copyTargets.length > 0 && (
            <Button variant="ghost" onClick={() => setCopyOpen(true)} aria-label="Copy to another class">
              <Copy aria-hidden /> <span className="hidden sm:inline">Copy</span>
            </Button>
          )}
          <Button variant="secondary" className="flex-1 lg:flex-none" loading={busy === "save"} onClick={() => save(false)}>
            Save draft
          </Button>
          <Button className="flex-[1.4] lg:flex-none" loading={busy === "submit"} onClick={() => save(true)} disabled={submitted && picked.size === initialTopics.length && [...picked].every((id) => initialTopics.includes(id)) && note === initialNote}>
            <Send aria-hidden /> {submitted ? "Update" : "Submit"}
          </Button>
        </StickyActions>
      )}
      {copyOpen && planId && <CopySheet planId={planId} targets={copyTargets} onClose={() => setCopyOpen(false)} />}
    </div>
  );
}

function Comments({ planId, comments, canComment }: { planId: string | null; comments: { id: string; text: string; at: string; authorName: string }[]; canComment: boolean }) {
  const [text, setText] = useState("");
  const { run, busy } = useMutation();
  if (!comments.length && !(canComment && planId)) return null;
  return (
    <Card>
      <CardHeader title="Comments" action={<MessageSquare className="size-5 text-muted" aria-hidden />} />
      <ul className="space-y-3 px-4 pb-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-xl bg-surface-2 p-3 text-sm">
            <p>{c.text}</p>
            <p className="mt-1 text-xs text-muted">{c.authorName} · {formatDateTime(c.at)}</p>
          </li>
        ))}
      </ul>
      {canComment && planId && (
        <div className="flex gap-2 border-t border-border p-3">
          <Textarea rows={1} className="min-h-11 py-2.5" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment for the teacher" aria-label="Comment" />
          <Button
            loading={busy}
            disabled={!text.trim()}
            onClick={async () => {
              const r = await run(() => api(`/weekly-plans/${planId}/comments`, { body: { text } }), { success: "Comment sent" });
              if (r !== undefined) setText("");
            }}
          >
            Send
          </Button>
        </div>
      )}
    </Card>
  );
}

function CopySheet({ planId, targets, onClose }: { planId: string; targets: { id: string; className: string }[]; onClose: () => void }) {
  const [sel, setSel] = useState<string[]>(targets.map((t) => t.id));
  const { run, busy } = useMutation();
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Copy plan to another class"
      description="Matching topics are selected in the other class's syllabus. Topics that don't exist there are listed."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={busy}
            disabled={!sel.length}
            onClick={async () => {
              const r = await run(() => api<{ matched: number; unmatched: string[] }[]>(`/weekly-plans/${planId}/copy-to`, { body: { targets: sel } }));
              if (r) {
                const missing = r.flatMap((x) => x.unmatched);
                toast.success(`Copied to ${r.length} class${r.length === 1 ? "" : "es"}`, { description: missing.length ? `Not found: ${missing.join(", ")}` : undefined });
                onClose();
              }
            }}
          >
            Copy plan
          </Button>
        </>
      }
    >
      <ul className="space-y-2">
        {targets.map((t) => {
          const on = sel.includes(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setSel((s) => (on ? s.filter((x) => x !== t.id) : [...s, t.id]))}
                className={cn("flex h-12 w-full items-center gap-3 rounded-xl border px-4 text-start font-medium", on ? "border-primary bg-primary-soft" : "border-border")}
              >
                <span className={cn("flex size-5 items-center justify-center rounded border-2", on ? "border-primary bg-primary text-primary-fg" : "border-border-strong")}>
                  {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                </span>
                {t.className}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
