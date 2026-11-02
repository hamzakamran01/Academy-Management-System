"use client";

import { BookOpen, ChevronDown, CircleSlash, NotebookPen, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TopicStatusIcon } from "@/components/progress-bits";
import { StickyActions } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { api, ApiClientError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";

type Topic = { id: string; title: string; size: number; status: "not_started" | "started" | "completed"; chapterTitle: string };
type Tree = { id: string; title: string; chapters: { id: string; title: string; topics: Omit<Topic, "chapterTitle">[] }[] }[];
type Mark = "started" | "completed";
type Reason = "test" | "revision" | "teacher_absent" | "event" | "other";

const REASONS: { v: Reason; l: string }[] = [
  { v: "test", l: "Test" },
  { v: "revision", l: "Revision" },
  { v: "teacher_absent", l: "Teacher absent" },
  { v: "event", l: "Event" },
  { v: "other", l: "Other" },
];

const pendingKey = "campusly:pending-lessons";

export function LessonForm({
  csId,
  date,
  canEdit,
  suggestions,
  plannedIds,
  tree,
  initial,
}: {
  csId: string;
  date: string;
  canEdit: boolean;
  suggestions: Topic[];
  plannedIds: string[];
  tree: Tree;
  initial: { topics: { topicId: string; status: Mark; pages: string | null }[]; noLessonReason: Reason | null; note: string | null } | null;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, Mark>>(() => Object.fromEntries((initial?.topics ?? []).map((t) => [t.topicId, t.status])));
  const [noLesson, setNoLesson] = useState<Reason | null>(initial?.noLessonReason ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [pages, setPages] = useState(initial?.topics.find((t) => t.pages)?.pages ?? "");
  const [hwOpen, setHwOpen] = useState(false);
  const [hw, setHw] = useState({ title: "", details: "", dueDate: addDays(date, 1) });
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Retry queued offline saves when we're back online (server dedupes by clientId).
  useEffect(() => {
    const flush = async () => {
      let queue: { csId: string; body: unknown; clientId: string }[] = [];
      try {
        queue = JSON.parse(localStorage.getItem(pendingKey) ?? "[]");
      } catch {
        return;
      }
      const left = [];
      for (const q of queue) {
        try {
          await api(`/class-subjects/${q.csId}/lesson-logs`, { method: "PUT", body: q.body, headers: { "Idempotency-Key": q.clientId } });
        } catch (err) {
          if (err instanceof ApiClientError && err.code === "OFFLINE") left.push(q);
        }
      }
      localStorage.setItem(pendingKey, JSON.stringify(left));
      if (queue.length > left.length) toast.success("Offline lesson logs sent");
    };
    window.addEventListener("online", flush);
    if (navigator.onLine) void flush();
    return () => window.removeEventListener("online", flush);
  }, []);

  const shownIds = new Set(suggestions.map((s) => s.id));
  const extra = useMemo(
    () =>
      tree.flatMap((b) => b.chapters.flatMap((c) => c.topics.filter((t) => !shownIds.has(t.id)).map((t) => ({ ...t, chapterTitle: c.title })))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tree, suggestions],
  );
  const selected = Object.keys(marks).length;

  const cycle = (id: string, to: Mark) =>
    setMarks((m) => {
      const n = { ...m };
      if (n[id] === to) delete n[id];
      else n[id] = to;
      return n;
    });

  async function save() {
    if (!noLesson && !selected) return toast.error("Tick at least one topic, or choose “No lesson today”");
    if (hwOpen && hw.title.trim().length > 0 && hw.title.trim().length < 2) return toast.error("Enter the homework");
    const clientId = crypto.randomUUID();
    const body = {
      date,
      topics: noLesson ? [] : Object.entries(marks).map(([topicId, status]) => ({ topicId, status, pages: pages || null })),
      noLessonReason: noLesson,
      note: note || null,
      homework: hwOpen && hw.title.trim() ? { title: hw.title, details: hw.details || null, dueDate: hw.dueDate } : null,
      clientId,
    };
    setBusy(true);
    try {
      await api(`/class-subjects/${csId}/lesson-logs`, { method: "PUT", body, headers: { "Idempotency-Key": clientId } });
      toast.success(noLesson ? "Saved — no lesson today" : `Lesson saved · ${selected} topic${selected === 1 ? "" : "s"}`);
      router.push(`/progress/${csId}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "OFFLINE") {
        const queue = JSON.parse(localStorage.getItem(pendingKey) ?? "[]");
        localStorage.setItem(pendingKey, JSON.stringify([...queue, { csId, body, clientId }]));
        toast("Offline — saved on this phone, will send when connected");
        router.push(`/progress/${csId}`);
      } else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return <Notice tone="warning">Lesson logs can be edited for 48 hours. Ask the office to change older logs.</Notice>;
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={!noLesson}
          onClick={() => setNoLesson(null)}
          className={cn("flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold", !noLesson ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface")}
        >
          <BookOpen className="size-4" aria-hidden /> Taught today
        </button>
        <button
          type="button"
          aria-pressed={!!noLesson}
          onClick={() => setNoLesson(noLesson ?? "test")}
          className={cn("flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold", noLesson ? "border-warning bg-warning-soft text-warning-fg" : "border-border bg-surface")}
        >
          <CircleSlash className="size-4" aria-hidden /> No lesson today
        </button>
      </div>

      {noLesson ? (
        <Card>
          <CardHeader title="Why no lesson?" description="So the gap is explained in progress reports." />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.v}
                  type="button"
                  aria-pressed={noLesson === r.v}
                  onClick={() => setNoLesson(r.v)}
                  className={cn("h-10 rounded-full border px-4 text-sm font-medium", noLesson === r.v ? "border-fg bg-fg text-bg" : "border-border bg-surface hover:bg-surface-2")}
                >
                  {r.l}
                </button>
              ))}
            </div>
            <Field label="Note" optional>{(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title={plannedIds.length ? "From this week's plan" : "Next in the syllabus"}
              description="Tap Started or Completed for what you taught."
              action={selected > 0 && <Badge tone="primary">{selected} selected</Badge>}
            />
            {suggestions.length === 0 ? (
              <CardBody>
                <p className="text-sm text-muted">No syllabus topics yet. Ask the office to add the syllabus.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {suggestions.map((t) => (
                  <TopicRow key={t.id} t={t} mark={marks[t.id]} onMark={cycle} planned={plannedIds.includes(t.id)} />
                ))}
              </ul>
            )}
          </Card>

          {extra.length > 0 && (
            <Card>
              <button type="button" onClick={() => setMoreOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3.5 text-start" aria-expanded={moreOpen}>
                <span className="font-semibold">Other topics</span>
                <ChevronDown className={cn("size-5 text-muted transition-transform", moreOpen && "rotate-180")} aria-hidden />
              </button>
              {moreOpen && (
                <ul className="divide-y divide-border border-t border-border">
                  {extra.map((t) => (
                    <TopicRow key={t.id} t={t} mark={marks[t.id]} onMark={cycle} />
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card>
            <CardBody className="space-y-4 pt-4">
              <Field label="Pages / exercise" optional hint="e.g. p. 42–45, Ex 4.2">
                {(p) => <Input {...p} value={pages} onChange={(e) => setPages(e.target.value)} />}
              </Field>
              <Field label="Note" optional>{(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            </CardBody>
          </Card>
        </>
      )}

      <Card>
        <button type="button" onClick={() => setHwOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-start" aria-expanded={hwOpen}>
          <span className="flex size-9 items-center justify-center rounded-lg bg-info-soft text-info-fg">
            <NotebookPen className="size-[18px]" aria-hidden />
          </span>
          <span className="flex-1 font-semibold">{hwOpen ? "Homework" : "Add homework"}</span>
          <ChevronDown className={cn("size-5 text-muted transition-transform", hwOpen && "rotate-180")} aria-hidden />
        </button>
        {hwOpen && (
          <CardBody className="space-y-4 border-t border-border pt-4">
            <Field label="Homework" required>{(p) => <Input {...p} value={hw.title} onChange={(e) => setHw({ ...hw, title: e.target.value })} placeholder="e.g. Exercise 4.2, Q1–6" />}</Field>
            <Field label="Details" optional>{(p) => <Textarea {...p} rows={2} value={hw.details} onChange={(e) => setHw({ ...hw, details: e.target.value })} />}</Field>
            <Field label="Due date" required>{(p) => <Input {...p} type="date" min={date} value={hw.dueDate} onChange={(e) => setHw({ ...hw, dueDate: e.target.value })} />}</Field>
            <p className="text-[13px] text-muted">Parents of students taking this subject are notified.</p>
          </CardBody>
        )}
      </Card>

      <StickyActions>
        <Button size="lg" block loading={busy} onClick={save} className="lg:w-auto">
          <Save aria-hidden /> Save lesson
        </Button>
      </StickyActions>
    </div>
  );
}

function TopicRow({ t, mark, onMark, planned }: { t: Topic; mark?: Mark; onMark: (id: string, m: Mark) => void; planned?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <TopicStatusIcon status={t.status} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-5">{t.title}</p>
        <p className="truncate text-xs text-muted">
          {t.chapterTitle}
          {planned ? " · planned" : ""}
          {t.status === "completed" ? " · already completed" : ""}
        </p>
      </div>
      <div className="inline-flex shrink-0 rounded-lg border border-border bg-surface-2 p-0.5" role="group" aria-label={`What happened with ${t.title}`}>
        <button
          type="button"
          aria-pressed={mark === "started"}
          onClick={() => onMark(t.id, "started")}
          className={cn("h-10 rounded-md px-2.5 text-[13px] font-semibold", mark === "started" ? "bg-warning text-white shadow-xs" : "text-muted")}
        >
          Started
        </button>
        <button
          type="button"
          aria-pressed={mark === "completed"}
          onClick={() => onMark(t.id, "completed")}
          className={cn("h-10 rounded-md px-2.5 text-[13px] font-semibold", mark === "completed" ? "bg-success text-white shadow-xs" : "text-muted")}
        >
          Done
        </button>
      </div>
    </li>
  );
}
