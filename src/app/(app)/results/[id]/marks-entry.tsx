"use client";

import { CheckCircle2, CloudOff, Loader2, Send, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { celebrate } from "@/components/motion/celebrate";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { api, ApiClientError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { classStats, fmtMark, markProblem } from "@/lib/grades";

export type EntryRow = { studentId: string; name: string; rollNo: string; value: number | null; isAbsent: boolean };
type Cell = { text: string; absent: boolean };
type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

const draftKey = (id: string) => `campusly:marks:${id}`;

/**
 * PRD §5.1 "Marks in front of names". Draft is autosaved to the server
 * (debounced) and mirrored to localStorage so nothing is lost offline (UX-06).
 */
export function MarksEntry({ testId, total, rows, passPercent }: { testId: string; total: number; rows: EntryRow[]; passPercent: number }) {
  const router = useRouter();
  const [cells, setCells] = useState<Record<string, Cell>>(() => {
    const init: Record<string, Cell> = {};
    for (const r of rows) init[r.studentId] = { text: r.isAbsent ? "" : r.value != null ? fmtMark(r.value) : "", absent: r.isAbsent };
    return init;
  });
  const dirty = useRef<Set<string>>(new Set());
  const [state, setState] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const inputs = useRef<Map<string, HTMLInputElement>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore-from-device after hydration: anything saved locally that differs from the server is pending.
  useEffect(() => {
    let saved: Record<string, Cell> | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(draftKey(testId)) ?? "null");
    } catch {
      /* private mode */
    }
    if (!saved) return;
    const known = new Set(rows.map((r) => r.studentId));
    for (const r of rows) {
      const c = saved[r.studentId];
      const server = r.isAbsent ? "A" : r.value != null ? fmtMark(r.value) : "";
      if (c && (c.absent ? "A" : c.text) !== server) dirty.current.add(r.studentId);
    }
    setCells((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(saved!).filter(([k]) => known.has(k))) }));
    if (dirty.current.size) {
      toast("Restored unsaved marks from this phone");
      schedule(300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsed = useMemo(() => {
    const out = rows.map((r) => {
      const c = cells[r.studentId]!;
      const num = c.text.trim() === "" ? null : Number(c.text);
      const problem = c.absent || num == null ? null : markProblem(num, total);
      return { ...r, value: c.absent || problem ? null : num, isAbsent: c.absent, problem, empty: !c.absent && num == null };
    });
    return out;
  }, [cells, rows, total]);
  const entered = parsed.filter((p) => !p.empty && !p.problem).length;
  const stats = classStats(parsed.filter((p) => !p.problem), total, passPercent);

  const flush = useCallback(async () => {
    const ids = [...dirty.current];
    if (!ids.length) return;
    const entries = ids
      .map((id) => parsed.find((p) => p.studentId === id)!)
      .filter((p) => p && !p.problem)
      .map((p) => ({ studentId: p.studentId, value: p.isAbsent ? null : p.value, absent: p.isAbsent }));
    ids.forEach((id) => dirty.current.delete(id));
    if (!entries.length) return;
    setState("saving");
    try {
      const res = await api<{ saved: number; errors: { studentId: string; message: string }[] }>(`/assessments/${testId}/marks`, { method: "PUT", body: { entries } });
      if (res.errors.length) toast.error(res.errors[0]!.message);
      setState(dirty.current.size ? "saving" : "saved");
      if (!dirty.current.size) localStorage.removeItem(draftKey(testId));
    } catch (err) {
      entries.forEach((e) => dirty.current.add(e.studentId));
      setState(err instanceof ApiClientError && err.code === "OFFLINE" ? "offline" : "error");
      if (!(err instanceof ApiClientError && err.code === "OFFLINE")) toast.error(errorMessage(err));
    }
  }, [parsed, testId]);

  const flushRef = useRef(flush);
  flushRef.current = flush;
  function schedule(ms = 1200) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), ms);
  }
  useEffect(() => {
    const online = () => dirty.current.size && schedule(0);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);

  function update(id: string, next: Cell) {
    setCells((c) => {
      const all = { ...c, [id]: next };
      try {
        localStorage.setItem(draftKey(testId), JSON.stringify(all));
      } catch {
        /* quota */
      }
      return all;
    });
    dirty.current.add(id);
    setMissing((m) => {
      if (!m.has(id)) return m;
      const n = new Set(m);
      n.delete(id);
      return n;
    });
    setState("saving");
    schedule();
  }

  function focusNext(i: number) {
    const next = rows[i + 1];
    if (next) inputs.current.get(next.studentId)?.focus();
    else inputs.current.get(rows[i]!.studentId)?.blur();
  }

  async function publish() {
    setPublishing(true);
    if (timer.current) clearTimeout(timer.current);
    await flush();
    try {
      const r = await api<{ notified: number }>(`/assessments/${testId}/publish`, { body: {} });
      localStorage.removeItem(draftKey(testId));
      celebrate({ title: "Results published", subtitle: `${r.notified} parent${r.notified === 1 ? "" : "s"} notified`, mood: "proud" });
      setConfirm(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  const problems = parsed.filter((p) => p.problem).length;
  const blanks = parsed.filter((p) => p.empty).length;

  return (
    <>
      <ol className="mb-3 flex items-center gap-2 text-[13px] font-medium" aria-label="Steps">
        <li className={cn("flex items-center gap-1.5", entered < rows.length ? "text-fg" : "text-success-fg")}>
          <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-bold", entered < rows.length ? "bg-primary text-primary-fg" : "bg-success text-white")}>1</span>
          Type marks
        </li>
        <span className="h-px w-6 bg-border-strong" aria-hidden />
        <li className="flex items-center gap-1.5 text-muted">
          <span className="flex size-5 items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold">2</span>
          Tap Publish
        </li>
        <span className="ms-auto text-xs font-normal text-subtle max-sm:hidden">Tip: press A for absent</span>
      </ol>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        {parsed.map((p, i) => (
          <li
            key={p.studentId}
            className={cn("flex items-center gap-3 px-3 py-2 sm:px-4", missing.has(p.studentId) && "bg-warning-soft/60", p.problem && "bg-danger-soft/50")}
          >
            <span className="tabular w-7 shrink-0 text-center text-sm font-semibold text-muted">{p.rollNo}</span>
            <div className="min-w-0 flex-1">
              <label htmlFor={`m-${p.studentId}`} className="line-clamp-2 text-[15px] font-medium leading-5">
                {p.name}
              </label>
              {p.problem && <p className="text-xs font-semibold text-danger-fg" role="alert">{p.problem}</p>}
              {missing.has(p.studentId) && !p.problem && <p className="text-xs font-semibold text-warning-fg">Enter marks or mark Absent</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {p.isAbsent ? (
                <span className="inline-flex h-12 w-[76px] items-center justify-center rounded-lg bg-neutral-soft text-sm font-semibold text-neutral-fg">Absent</span>
              ) : (
                <div className="relative">
                  <input
                    id={`m-${p.studentId}`}
                    ref={(el) => {
                      if (el) inputs.current.set(p.studentId, el);
                      else inputs.current.delete(p.studentId);
                    }}
                    type="text"
                    inputMode="decimal"
                    enterKeyHint={i === rows.length - 1 ? "done" : "next"}
                    autoComplete="off"
                    value={cells[p.studentId]!.text}
                    onChange={(e) => update(p.studentId, { text: e.target.value.replace(/[^0-9.]/g, "").slice(0, 5), absent: false })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusNext(i);
                      } else if (e.key.toLowerCase() === "a") {
                        e.preventDefault();
                        update(p.studentId, { text: "", absent: true });
                        focusNext(i);
                      }
                    }}
                    aria-invalid={!!p.problem}
                    aria-label={`Marks for ${p.name} out of ${total}`}
                    className={cn(
                      "tabular h-12 w-[76px] rounded-lg border bg-surface pe-7 ps-2 text-end text-lg font-semibold shadow-xs focus:outline-none focus:ring-4",
                      p.problem ? "border-danger focus:ring-danger/20" : "border-border focus:border-primary focus:ring-ring",
                    )}
                  />
                  <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-xs text-subtle">/{fmtMark(total)}</span>
                </div>
              )}
              <button
                type="button"
                aria-pressed={p.isAbsent}
                aria-label={p.isAbsent ? `Mark ${p.name} present` : `Mark ${p.name} absent`}
                onClick={() => update(p.studentId, { text: "", absent: !p.isAbsent })}
                className={cn(
                  "inline-flex size-12 items-center justify-center rounded-lg border text-sm font-bold transition-colors",
                  p.isAbsent ? "border-fg bg-fg text-bg" : "border-border bg-surface text-muted hover:bg-surface-2",
                )}
              >
                A
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Sticky footer: progress, live average, actions */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-xl lg:sticky lg:bottom-4 lg:mt-4 lg:rounded-xl lg:border lg:shadow-raised">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="font-semibold">
              <span className="tabular">{entered}</span>/{rows.length} entered
              {stats.average != null && <span className="font-normal text-muted"> · avg <span className="tabular font-semibold text-fg">{fmtMark(stats.average)}</span></span>}
            </p>
            <SaveIndicator state={state} problems={problems} />
          </div>
          <Button onClick={() => setConfirm(true)} disabled={publishing || rows.length === 0}>
            <Send aria-hidden /> Publish
          </Button>
        </div>
      </div>
      <div className="h-20 lg:hidden" aria-hidden />

      <Sheet
        open={confirm}
        onOpenChange={setConfirm}
        size="sm"
        title="Publish results?"
        description="Parents are notified right away. After publishing, only the office can unlock marks for corrections."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Keep editing</Button>
            <Button loading={publishing} disabled={problems > 0} onClick={publish}>Publish</Button>
          </>
        }
      >
        <div className="space-y-3">
          {problems > 0 ? (
            <Notice tone="danger">{problems} mark{problems === 1 ? " is" : "s are"} above the total — fix {problems === 1 ? "it" : "them"} first.</Notice>
          ) : blanks > 0 ? (
            <Notice tone="warning">
              {blanks} student{blanks === 1 ? " has" : "s have"} no marks — they will be marked <b>Absent</b>.
            </Notice>
          ) : null}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label="Average" value={stats.average != null ? fmtMark(stats.average) : "—"} />
            <Mini label="Highest" value={stats.highest != null ? fmtMark(stats.highest) : "—"} />
            <Mini label="Absent" value={String(stats.absent + blanks)} />
          </div>
        </div>
      </Sheet>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="tabular text-lg font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function SaveIndicator({ state, problems }: { state: SaveState; problems: number }) {
  if (problems) return <p className="text-danger-fg">{problems} mark{problems === 1 ? "" : "s"} need fixing</p>;
  const map = {
    idle: { icon: CheckCircle2, text: "Draft saved", cls: "text-muted" },
    saved: { icon: CheckCircle2, text: "All changes saved", cls: "text-success-fg" },
    saving: { icon: Loader2, text: "Saving…", cls: "text-muted" },
    offline: { icon: CloudOff, text: "Offline — saved on this phone", cls: "text-warning-fg" },
    error: { icon: UserX, text: "Not saved — will retry", cls: "text-danger-fg" },
  }[state];
  const Icon = map.icon;
  return (
    <p className={cn("flex items-center gap-1", map.cls)} aria-live="polite">
      <Icon className={cn("size-3.5", state === "saving" && "animate-spin")} aria-hidden /> {map.text}
    </p>
  );
}
