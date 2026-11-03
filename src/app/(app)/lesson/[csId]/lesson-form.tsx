"use client";

import { BookOpenText, CircleSlash, NotebookPen, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { celebrate } from "@/components/motion/celebrate";
import { StickyActions } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/field";
import { api, ApiClientError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";

type Reason = "test" | "revision" | "teacher_absent" | "event" | "other";
const REASONS: { v: Reason; l: string }[] = [
  { v: "test", l: "Test day" },
  { v: "revision", l: "Revision" },
  { v: "teacher_absent", l: "I was absent" },
  { v: "event", l: "Holiday / event" },
  { v: "other", l: "Other" },
];

const pendingKey = "campusly:pending-logs";
type Pending = { csId: string; body: unknown; clientId: string };

/** Send logs saved while offline once the phone is back online (server dedupes by clientId). */
function useOfflineQueue() {
  useEffect(() => {
    const flush = async () => {
      let queue: Pending[] = [];
      try {
        queue = JSON.parse(localStorage.getItem(pendingKey) ?? "[]");
      } catch {
        return;
      }
      if (!queue.length) return;
      const left: Pending[] = [];
      for (const q of queue) {
        try {
          await api(`/class-subjects/${q.csId}/lesson-logs`, { method: "PUT", body: q.body, headers: { "Idempotency-Key": q.clientId } });
        } catch (err) {
          if (err instanceof ApiClientError && err.code === "OFFLINE") left.push(q);
        }
      }
      localStorage.setItem(pendingKey, JSON.stringify(left));
      if (queue.length > left.length) toast.success("Logs saved offline have been sent");
    };
    window.addEventListener("online", flush);
    void flush();
    return () => window.removeEventListener("online", flush);
  }, []);
}

/**
 * The daily log: what I taught today, homework (optional) — or "no class today".
 * Two text boxes and one button. Nothing to match against a syllabus.
 */
export function LessonForm({
  csId,
  date,
  isToday,
  canEdit,
  initial,
  doneHref,
}: {
  csId: string;
  date: string;
  isToday: boolean;
  canEdit: boolean;
  initial: { taught: string | null; homework: string | null; noClassReason: Reason | null } | null;
  doneHref: string;
}) {
  const router = useRouter();
  const [taught, setTaught] = useState(initial?.taught ?? "");
  const [homework, setHomework] = useState(initial?.homework ?? "");
  const [noClass, setNoClass] = useState<Reason | null>(initial?.noClassReason ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useOfflineQueue();

  const ready = noClass ? true : taught.trim().length > 0;

  async function save() {
    if (!ready) {
      setError("Write what you taught, or choose “No class today”.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = { date, taught: noClass ? null : taught, homework: noClass ? null : homework, noClassReason: noClass };
    const clientId = crypto.randomUUID();
    try {
      await api(`/class-subjects/${csId}/lesson-logs`, { method: "PUT", body, headers: { "Idempotency-Key": clientId } });
      celebrate({ title: initial ? "Log updated" : "Log saved", subtitle: noClass ? "Marked as no class" : homework.trim() ? "Parents will see the homework" : "Nice work today", mood: "proud" });
      router.push(doneHref);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "OFFLINE") {
        const queue: Pending[] = JSON.parse(localStorage.getItem(pendingKey) ?? "[]");
        localStorage.setItem(pendingKey, JSON.stringify([...queue, { csId, body, clientId }]));
        toast("You're offline — saved on this phone and will send automatically");
        router.push(doneHref);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <Notice tone="info" title="This day is closed">
        Logs can be written or changed for 2 days. Ask the office if something needs fixing.
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Notice tone="danger">{error}</Notice>}

      <Card className={cn("p-4 transition-opacity", noClass && "opacity-50")}>
        <label htmlFor="taught" className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
            <BookOpenText className="size-[18px]" aria-hidden />
          </span>
          What did you teach {isToday ? "today" : "that day"}?
        </label>
        <Textarea
          id="taught"
          rows={4}
          className="mt-3 text-[15px] leading-6"
          placeholder="e.g. Chapter 3 — Newton's laws, examples 3.1 to 3.4"
          value={taught}
          disabled={!!noClass}
          onChange={(e) => {
            setTaught(e.target.value);
            setError(null);
          }}
          autoFocus={!initial}
          maxLength={2000}
        />
      </Card>

      <Card className={cn("p-4 transition-opacity", noClass && "opacity-50")}>
        <label htmlFor="homework" className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success-fg">
            <NotebookPen className="size-[18px]" aria-hidden />
          </span>
          Homework given <span className="text-sm font-normal text-subtle">(optional)</span>
        </label>
        <Textarea
          id="homework"
          rows={2}
          className="mt-3 text-[15px] leading-6"
          placeholder="e.g. Exercise 3.2, questions 1–5"
          value={homework}
          disabled={!!noClass}
          onChange={(e) => setHomework(e.target.value)}
          maxLength={1000}
        />
        <p className="mt-1.5 text-xs text-muted">Parents get a notification when you add homework.</p>
      </Card>

      <div>
        <p className="mb-2 flex items-center gap-1.5 px-1 text-sm font-medium text-muted">
          <CircleSlash className="size-4" aria-hidden /> No class {isToday ? "today" : "that day"}?
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="No class reason">
          {REASONS.map((r) => (
            <button
              key={r.v}
              type="button"
              role="radio"
              aria-checked={noClass === r.v}
              onClick={() => {
                setNoClass((cur) => (cur === r.v ? null : r.v));
                setError(null);
              }}
              className={cn(
                "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-[background-color,transform] active:scale-95",
                noClass === r.v ? "border-fg bg-fg text-bg" : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              {r.l}
            </button>
          ))}
        </div>
      </div>

      <div className="h-20 lg:hidden" aria-hidden />
      <StickyActions>
        <Button size="lg" block className="lg:w-auto lg:min-w-48" loading={busy} onClick={save} disabled={!ready}>
          <Save aria-hidden /> {initial ? "Update log" : "Save log"}
        </Button>
      </StickyActions>
    </div>
  );
}
