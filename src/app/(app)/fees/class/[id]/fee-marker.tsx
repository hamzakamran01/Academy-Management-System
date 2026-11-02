"use client";

import { Check, Hourglass, MinusCircle, MoreHorizontal, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, SearchInput, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney, formatRelative } from "@/lib/format";

export type MarkRow = {
  id: string;
  studentId: string;
  name: string;
  rollNo: string | null;
  status: "paid" | "unpaid" | "waived";
  amount?: number;
  markedAt: string | null;
  markedByName: string | null;
};

/**
 * PRD §5.1 "Fee marking in class": big Paid/Unpaid toggle per student,
 * optimistic update with a 5-second Undo, live counters, Unpaid-only filter.
 */
export function FeeMarker({
  initial,
  canMark,
  isOwner,
  showAmounts,
}: {
  initial: MarkRow[];
  canMark: boolean;
  isOwner: boolean;
  showAmounts: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [waiving, setWaiving] = useState<MarkRow | null>(null);
  const inflight = useRef(new Map<string, number>());

  const counts = useMemo(
    () => ({
      paid: rows.filter((r) => r.status === "paid").length,
      unpaid: rows.filter((r) => r.status === "unpaid").length,
      waived: rows.filter((r) => r.status === "waived").length,
    }),
    [rows],
  );
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (!unpaidOnly || r.status === "unpaid") && (!t || r.name.toLowerCase().includes(t) || r.rollNo === t));
  }, [rows, q, unpaidOnly]);
  const recovered = showAmounts ? rows.filter((r) => r.status === "paid").reduce((n, r) => n + (r.amount ?? 0), 0) : 0;

  const patch = (id: string, p: Partial<MarkRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function send(row: MarkRow, to: "paid" | "unpaid", silent = false) {
    const prev = { status: row.status, markedAt: row.markedAt, markedByName: row.markedByName };
    const seq = (inflight.current.get(row.id) ?? 0) + 1;
    inflight.current.set(row.id, seq);
    patch(row.id, { status: to, markedAt: to === "paid" ? new Date().toISOString() : null, markedByName: to === "paid" ? "You" : null });
    setBusy((b) => new Set(b).add(row.id));
    try {
      await api(`/fees/rows/${row.id}/${to}`, { body: {} });
      if (!silent) {
        toast(to === "paid" ? `${row.name} — Paid` : `${row.name} — Unpaid`, {
          duration: 5000,
          action: { label: "Undo", onClick: () => void send({ ...row, status: to }, prev.status === "paid" ? "paid" : "unpaid", true) },
        });
      }
    } catch (err) {
      if (inflight.current.get(row.id) === seq) patch(row.id, prev);
      toast.error(errorMessage(err));
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(row.id);
        return n;
      });
    }
  }

  return (
    <>
      {/* Sticky counters (PRD §5.1: "Paid 31 · Unpaid 9 · Remaining 9") */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 mb-3 border-b border-border bg-bg/90 px-4 pb-3 pt-1 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:rounded-xl lg:border lg:bg-surface lg:p-4">
        <div className="grid grid-cols-3 gap-2" aria-live="polite">
          <Counter label="Paid" value={counts.paid} tone="success" />
          <Counter label="Unpaid" value={counts.unpaid} tone="warning" />
          <Counter label={counts.waived ? "Waived" : "Total"} value={counts.waived || rows.length} tone="neutral" />
        </div>
        {showAmounts && (
          <p className="mt-2 text-center text-[13px] text-muted">
            Recovered <span className="tabular font-semibold text-fg">{formatMoney(recovered)}</span>
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <SearchInput className="flex-1" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
          <button
            type="button"
            aria-pressed={unpaidOnly}
            onClick={() => setUnpaidOnly((u) => !u)}
            className={cn(
              "h-11 shrink-0 rounded-lg border px-3.5 text-sm font-semibold transition-colors",
              unpaidOnly ? "border-warning bg-warning-soft text-warning-fg" : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            Unpaid only
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center text-muted">
          <SearchX className="mb-2 size-8" aria-hidden />
          <p className="text-sm">{unpaidOnly && counts.unpaid === 0 ? "Everyone has paid this month 🎉" : "No students match"}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          {shown.map((r) => (
            <li key={r.id} className="flex min-h-[68px] items-center gap-3 px-3 py-2.5 sm:px-4">
              <span className="tabular w-6 shrink-0 text-center text-sm font-semibold text-muted">{r.rollNo ?? "–"}</span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[15px] font-medium leading-5">{r.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {showAmounts && r.amount !== undefined && <span className="tabular font-medium text-fg/80">{formatMoney(r.amount)} · </span>}
                  {r.status === "paid" && r.markedAt
                    ? `Paid ${formatRelative(r.markedAt)}${r.markedByName ? ` · ${r.markedByName}` : ""}`
                    : r.status === "waived"
                      ? "Waived by owner"
                      : "Not paid yet"}
                </p>
              </div>
              {r.status === "waived" ? (
                <span className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-neutral-soft px-3 text-sm font-semibold text-neutral-fg">
                  <MinusCircle className="size-4" aria-hidden /> Waived
                </span>
              ) : (
                <PaidToggle
                  paid={r.status === "paid"}
                  disabled={!canMark || busy.has(r.id)}
                  onChange={(paid) => send(r, paid ? "paid" : "unpaid")}
                  name={r.name}
                />
              )}
              {isOwner && (
                <Button variant="ghost" size="icon-sm" className="-ms-1 -me-2 w-8" aria-label={`More for ${r.name}`} onClick={() => setWaiving(r)}>
                  <MoreHorizontal />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {waiving && (
        <WaiveSheet
          row={waiving}
          onClose={() => setWaiving(null)}
          onDone={(status) => {
            patch(waiving.id, { status, markedAt: null, markedByName: null });
            setWaiving(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "neutral" }) {
  const cls = { success: "bg-success-soft text-success-fg", warning: "bg-warning-soft text-warning-fg", neutral: "bg-neutral-soft text-neutral-fg" }[tone];
  return (
    <div className={cn("rounded-xl px-3 py-2 text-center", cls)}>
      <p className="tabular text-xl font-bold leading-7">{value}</p>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  );
}

/**
 * One large state toggle (PRD §5.1) — text + icon + colour (UX-04).
 * Paid: solid green. Unpaid: amber outline. Tap flips it; Undo is offered.
 */
function PaidToggle({ paid, disabled, onChange, name }: { paid: boolean; disabled: boolean; onChange: (paid: boolean) => void; name: string }) {
  return (
    <button
      type="button"
      aria-pressed={paid}
      aria-label={`${name}: ${paid ? "Paid — tap to mark unpaid" : "Unpaid — tap to mark paid"}`}
      disabled={disabled}
      onClick={() => onChange(!paid)}
      className={cn(
        "inline-flex h-11 w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60",
        paid ? "bg-success text-white shadow-xs" : "border-2 border-warning/70 bg-warning-soft text-warning-fg",
      )}
    >
      {paid ? <Check className="size-[18px]" strokeWidth={2.6} aria-hidden /> : <Hourglass className="size-4" aria-hidden />}
      {paid ? "Paid" : "Unpaid"}
    </button>
  );
}

function WaiveSheet({ row, onClose, onDone }: { row: MarkRow; onClose: () => void; onDone: (s: "waived" | "unpaid") => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const waived = row.status === "waived";
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={waived ? `Un-waive ${row.name}?` : `Waive this month for ${row.name}?`}
      description={waived ? "The month becomes Unpaid again and counts towards expected revenue." : "A waived month is excluded from expected revenue. Only the owner can do this."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant={waived ? "primary" : "danger"}
            loading={busy}
            disabled={!waived && reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                if (waived) await api(`/fees/rows/${row.id}/unpaid`, { body: {} });
                else await api(`/fees/rows/${row.id}/waive`, { body: { reason } });
                toast.success(waived ? "Month un-waived" : "Month waived");
                onDone(waived ? "unpaid" : "waived");
              } catch (err) {
                toast.error(errorMessage(err));
                setBusy(false);
              }
            }}
          >
            {waived ? "Un-waive" : "Waive month"}
          </Button>
        </>
      }
    >
      {!waived && row.status !== "paid" && (
        <Field label="Reason" required hint="e.g. Hardship, scholarship">
          {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      )}
      {!waived && row.status === "paid" && <p className="text-sm text-muted">This month is already paid — mark it Unpaid first.</p>}
    </Sheet>
  );
}
