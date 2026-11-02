import { History, Lock } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/field";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/roles";
import { requireCtx } from "@/server/auth/session";
import { listActivity } from "@/server/modules/admin";

export const metadata: Metadata = { title: "Activity log" };
export const dynamic = "force-dynamic";

const TYPES = [
  ["student", "Students"],
  ["fee_row", "Fee marks"],
  ["assessment", "Results"],
  ["lesson_log", "Lesson logs"],
  ["class", "Classes"],
  ["user", "Accounts"],
  ["salary_row", "Salaries"],
  ["academy", "Settings"],
] as const;

function diff(before: unknown, after: unknown): string | null {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return null;
  const parts: string[] = [];
  for (const k of Object.keys(after as object)) {
    const b = (before as Record<string, unknown>)[k];
    const a = (after as Record<string, unknown>)[k];
    if (b !== undefined && JSON.stringify(b) !== JSON.stringify(a) && (typeof a !== "object" || a === null)) parts.push(`${k}: ${String(b ?? "—")} → ${String(a ?? "—")}`);
  }
  return parts.length ? parts.slice(0, 3).join(" · ") : null;
}

/** FR-ADM-01/02: append-only log; admins don't see fee-amount or salary entries. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string }> }) {
  const ctx = await requireCtx(["super_admin", "admin"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const type = TYPES.some(([k]) => k === sp.type) ? sp.type : undefined;
  const rows = await listActivity(ctx, { q: sp.q, entityType: type, limit: 50, offset: (page - 1) * 50 });
  const qs = (p: number) => `/activity?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(type ? { type } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Activity log" subtitle="Who changed what, and when — cannot be edited or deleted" back="/more" />
      <form action="/activity" className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput name="q" defaultValue={sp.q} placeholder="Search activity" className="flex-1" />
        <div className="flex gap-2">
          <AutoSubmitSelect name="type" defaultValue={type ?? ""} className="h-11 w-auto min-w-36 text-sm" aria-label="Type">
            <option value="">Everything</option>
            {TYPES.filter(([k]) => ctx.role === "super_admin" || k !== "salary_row").map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </AutoSubmitSelect>
        </div>
      </form>
      {ctx.role === "admin" && (
        <p className="mb-3 flex items-center gap-1.5 text-[13px] text-muted">
          <Lock className="size-3.5" aria-hidden /> Fee-amount and salary changes are visible to the owner only.
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={History} title="No activity found" />
      ) : (
        <ol className="relative ms-3 border-s border-border">
          {rows.map((r) => {
            const d = diff(r.before, r.after);
            return (
              <li key={r.id} className="ms-5 pb-4">
                <span className="absolute -start-[5px] mt-2 size-2.5 rounded-full bg-primary ring-4 ring-bg" aria-hidden />
                <div className="rounded-xl border border-border bg-surface p-3 shadow-card">
                  <p className="text-[15px] font-medium leading-5">{r.summary ?? r.action}</p>
                  {d && <p className="mt-1 font-mono text-xs text-muted">{d}</p>}
                  {r.reason && <p className="mt-1 text-[13px] text-muted">Reason: {r.reason}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span className="font-medium text-fg">{r.actorName ?? "System"}</span>
                    {r.actorRole && <Badge>{ROLE_LABEL[r.actorRole]}</Badge>}
                    {r.sensitivity !== "normal" && <Badge tone="warning" icon={Lock}>{r.sensitivity === "salary" ? "Salary" : "Fee amount"}</Badge>}
                    <span>· {formatDateTime(r.at)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-2 flex justify-between">
        {page > 1 ? <ButtonLink href={qs(page - 1)} variant="secondary" size="sm">Newer</ButtonLink> : <span />}
        {rows.length === 50 && <ButtonLink href={qs(page + 1)} variant="secondary" size="sm">Older</ButtonLink>}
      </div>
    </>
  );
}
