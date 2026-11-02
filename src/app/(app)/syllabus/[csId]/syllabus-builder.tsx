"use client";

import { ArrowDown, ArrowUp, Copy, Minus, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StickyActions } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useMutation } from "@/lib/use-mutation";

type T = { key: string; id?: string; title: string; size: number; status?: string };
type C = { key: string; id?: string; title: string; targetDate: string; topics: T[] };
type B = { key: string; id?: string; title: string; chapters: C[] };

let seq = 0;
const k = () => `n${++seq}`;

function move<X>(arr: X[], i: number, d: -1 | 1): X[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

export function SyllabusBuilder({
  csId,
  initial,
  targets,
}: {
  csId: string;
  initial: { id: string; title: string; chapters: { id: string; title: string; targetDate: string | null; topics: { id: string; title: string; size: number; status: string }[] }[] }[];
  targets: { id: string; className: string }[];
}) {
  const router = useRouter();
  const [books, setBooks] = useState<B[]>(() =>
    initial.length
      ? initial.map((b) => ({ key: b.id, id: b.id, title: b.title, chapters: b.chapters.map((c) => ({ key: c.id, id: c.id, title: c.title, targetDate: c.targetDate ?? "", topics: c.topics.map((t) => ({ key: t.id, ...t })) })) }))
      : [{ key: k(), title: "", chapters: [{ key: k(), title: "", targetDate: "", topics: [{ key: k(), title: "", size: 1 }] }] }],
  );
  const [busy, setBusy] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const total = books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.topics.reduce((s, t) => s + (t.title.trim() ? t.size : 0), 0), 0), 0);

  const upd = (fn: (b: B[]) => B[]) => setBooks((x) => fn(structuredClone(x)));

  async function save() {
    const payload = {
      books: books
        .filter((b) => b.title.trim())
        .map((b) => ({
          id: b.id,
          title: b.title,
          chapters: b.chapters
            .filter((c) => c.title.trim())
            .map((c) => ({ id: c.id, title: c.title, targetDate: c.targetDate || null, topics: c.topics.filter((t) => t.title.trim()).map((t) => ({ id: t.id, title: t.title, size: t.size })) })),
        })),
    };
    setBusy(true);
    try {
      await api(`/class-subjects/${csId}/syllabus`, { method: "PUT", body: payload });
      toast.success("Syllabus saved");
      router.push(`/progress/${csId}`);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <p className="text-[13px] text-muted">
        Topic <b>size</b> = number of periods it takes — bigger topics count more towards coverage. A chapter's <b>target date</b> powers the “expected” line.
        Total: <span className="tabular font-semibold text-fg">{total} periods</span>
      </p>
      {books.map((b, bi) => (
        <Card key={b.key} className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-surface-2 p-3">
            <Input
              aria-label="Book title"
              placeholder="Book title, e.g. Physics 9 (Punjab Textbook Board)"
              value={b.title}
              onChange={(e) => upd((x) => ((x[bi]!.title = e.target.value), x))}
              className="h-11 font-semibold"
            />
            {books.length > 1 && (
              <Button variant="ghost" size="icon-sm" aria-label="Remove book" onClick={() => upd((x) => x.filter((_, i) => i !== bi))}>
                <Trash2 />
              </Button>
            )}
          </div>
          <div className="space-y-3 p-3">
            {b.chapters.map((c, ci) => (
              <div key={c.key} className="rounded-xl border border-border">
                <div className="flex flex-wrap items-center gap-2 p-2.5">
                  <span className="tabular w-6 text-center text-sm font-bold text-muted">{ci + 1}</span>
                  <Input
                    aria-label="Chapter title"
                    placeholder="Chapter title"
                    value={c.title}
                    onChange={(e) => upd((x) => ((x[bi]!.chapters[ci]!.title = e.target.value), x))}
                    className="h-10 min-w-40 flex-1 font-medium"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    Target
                    <Input
                      type="date"
                      aria-label="Chapter target date"
                      value={c.targetDate}
                      onChange={(e) => upd((x) => ((x[bi]!.chapters[ci]!.targetDate = e.target.value), x))}
                      className="h-10 w-40 text-sm"
                    />
                  </label>
                  <div className="flex">
                    <Button variant="ghost" size="icon-sm" aria-label="Move chapter up" disabled={ci === 0} onClick={() => upd((x) => ((x[bi]!.chapters = move(x[bi]!.chapters, ci, -1)), x))}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Move chapter down" disabled={ci === b.chapters.length - 1} onClick={() => upd((x) => ((x[bi]!.chapters = move(x[bi]!.chapters, ci, 1)), x))}>
                      <ArrowDown />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Remove chapter" onClick={() => upd((x) => ((x[bi]!.chapters = x[bi]!.chapters.filter((_, i) => i !== ci)), x))}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <ul className="border-t border-border">
                  {c.topics.map((t, ti) => (
                    <li key={t.key} className="flex items-center gap-2 border-b border-border px-2.5 py-2 last:border-b-0">
                      <Input
                        aria-label="Topic"
                        placeholder="Topic"
                        value={t.title}
                        onChange={(e) => upd((x) => ((x[bi]!.chapters[ci]!.topics[ti]!.title = e.target.value), x))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            upd((x) => (x[bi]!.chapters[ci]!.topics.splice(ti + 1, 0, { key: k(), title: "", size: 1 }), x));
                          }
                        }}
                        className={cn("h-10 flex-1 text-[15px]", t.status === "completed" && "text-success-fg")}
                      />
                      <div className="flex items-center rounded-lg border border-border" role="group" aria-label="Periods">
                        <button type="button" className="flex size-9 items-center justify-center text-muted disabled:opacity-30" aria-label="Fewer periods" disabled={t.size <= 1} onClick={() => upd((x) => ((x[bi]!.chapters[ci]!.topics[ti]!.size = t.size - 1), x))}>
                          <Minus className="size-4" />
                        </button>
                        <span className="tabular w-6 text-center text-sm font-semibold" aria-label={`${t.size} periods`}>{t.size}</span>
                        <button type="button" className="flex size-9 items-center justify-center text-muted disabled:opacity-30" aria-label="More periods" disabled={t.size >= 20} onClick={() => upd((x) => ((x[bi]!.chapters[ci]!.topics[ti]!.size = t.size + 1), x))}>
                          <Plus className="size-4" />
                        </button>
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label="Remove topic" onClick={() => upd((x) => ((x[bi]!.chapters[ci]!.topics = x[bi]!.chapters[ci]!.topics.filter((_, i) => i !== ti)), x))}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-center gap-1.5 text-sm font-medium text-primary hover:bg-surface-2"
                  onClick={() => upd((x) => (x[bi]!.chapters[ci]!.topics.push({ key: k(), title: "", size: 1 }), x))}
                >
                  <Plus className="size-4" aria-hidden /> Add topic
                </button>
              </div>
            ))}
            <Button variant="soft" size="sm" onClick={() => upd((x) => (x[bi]!.chapters.push({ key: k(), title: "", targetDate: "", topics: [{ key: k(), title: "", size: 1 }] }), x))}>
              <Plus aria-hidden /> Add chapter
            </Button>
          </div>
        </Card>
      ))}
      <Button variant="secondary" size="sm" onClick={() => setBooks((x) => [...x, { key: k(), title: "", chapters: [] }])}>
        <Plus aria-hidden /> Add another book
      </Button>

      <StickyActions>
        {targets.length > 0 && initial.length > 0 && (
          <Button variant="ghost" onClick={() => setCopyOpen(true)}>
            <Copy aria-hidden /> <span className="hidden sm:inline">Copy to classes</span>
          </Button>
        )}
        <Button size="lg" loading={busy} onClick={save} className="flex-1 lg:flex-none">
          <Save aria-hidden /> Save syllabus
        </Button>
      </StickyActions>
      {copyOpen && <CopySyllabus csId={csId} targets={targets} onClose={() => setCopyOpen(false)} />}
    </div>
  );
}

function CopySyllabus({ csId, targets, onClose }: { csId: string; targets: { id: string; className: string }[]; onClose: () => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const { run, busy } = useMutation();
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Copy syllabus"
      description="Adds this saved syllabus to the selected classes (same subject). Weekly plans can then be copied between them."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={!sel.length} onClick={async () => { const r = await run(() => api(`/class-subjects/${csId}/syllabus/copy-to`, { body: { targets: sel } }), { success: "Syllabus copied" }); if (r !== undefined) onClose(); }}>
            Copy to {sel.length || ""} class{sel.length === 1 ? "" : "es"}
          </Button>
        </>
      }
    >
      <ul className="space-y-2">
        {targets.map((t) => {
          const on = sel.includes(t.id);
          return (
            <li key={t.id}>
              <button type="button" aria-pressed={on} onClick={() => setSel((s) => (on ? s.filter((x) => x !== t.id) : [...s, t.id]))} className={cn("flex h-12 w-full items-center rounded-xl border px-4 text-start font-medium", on ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border")}>
                {t.className}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
