"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatMoney, formatMonth, formatPercent } from "@/lib/format";

type Point = { month: string; expected: number; recovered: number };

/** Clean axis steps: 0 / 50k / 100k … in compact form once the axis reaches 10,000. */
function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const tick = (v: number, compact: boolean) =>
  v === 0 ? "0" : compact ? (v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : `${+(v / 1000).toFixed(0)}K`) : v.toLocaleString("en-PK");

/**
 * Monthly fee recovery: one colour series (Recovered, columns) and the month's
 * Expected as a muted reference tick — one axis, one hue, legend + tooltip + table.
 */
export function RecoveryChart({ data }: { data: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.expected, d.recovered)), 0));
  const compact = max >= 10_000;
  const ticks = [0, max / 2, max];
  const a = active != null ? data[active] : null;

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-2.5 rounded-t-[3px] bg-chart-1" /> Recovered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full bg-muted" /> Expected
        </span>
      </div>

      <div className="relative" onMouseLeave={() => setActive(null)}>
        {/* y-axis + gridlines (hairline, solid, recessive) */}
        <div className="pointer-events-none absolute inset-0 bottom-6 start-10">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-chart-grid" style={{ bottom: `${(t / max) * 100}%` }}>
              <span className="tabular absolute -start-10 -translate-y-1/2 text-[11px] text-muted">{tick(t, compact)}</span>
            </div>
          ))}
        </div>

        <div className="relative ms-10 flex h-48 items-end gap-0.5" role="img" aria-label="Fee recovered versus expected for the last 12 months. A table view follows.">
          {data.map((d, i) => {
            const rh = (d.recovered / max) * 100;
            const eh = (d.expected / max) * 100;
            const on = active === i;
            return (
              <button
                key={d.month}
                type="button"
                className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${formatMonth(d.month)}: recovered ${formatMoney(d.recovered)} of ${formatMoney(d.expected)} expected`}
              >
                <span className={cn("absolute inset-0 rounded-md transition-colors", on && "bg-surface-2")} aria-hidden />
                {d.expected > 0 && (
                  <span
                    className="absolute z-10 h-0.5 w-[min(36px,90%)] rounded-full bg-muted"
                    style={{ bottom: `calc(${eh}% - 1px)` }}
                    aria-hidden
                  />
                )}
                <span
                  className={cn("relative w-[min(24px,70%)] rounded-t bg-chart-1 transition-opacity", active != null && !on && "opacity-55")}
                  style={{ height: `${rh}%`, minHeight: d.recovered > 0 ? 2 : 0 }}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>

        <div className="ms-10 mt-1.5 flex gap-0.5" aria-hidden>
          {data.map((d, i) => (
            <span key={d.month} className={cn("flex-1 text-center text-[11px] text-muted", data.length > 8 && i % 2 === 1 && "max-sm:invisible")}>
              {formatMonth(d.month, true).split(" ")[0]}
            </span>
          ))}
        </div>

        {a && (
          <div
            className="pointer-events-none absolute -top-2 z-20 w-48 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-surface p-3 text-[13px] shadow-raised"
            style={{ left: `calc(2.5rem + (100% - 2.5rem) * ${(active! + 0.5) / data.length})` }}
            role="status"
          >
            <p className="mb-1.5 font-semibold">{formatMonth(a.month)}</p>
            <p className="flex justify-between gap-3"><span className="text-muted">Recovered</span><span className="tabular font-semibold">{formatMoney(a.recovered)}</span></p>
            <p className="flex justify-between gap-3"><span className="text-muted">Expected</span><span className="tabular">{formatMoney(a.expected)}</span></p>
            <p className="flex justify-between gap-3"><span className="text-muted">Recovery</span><span className="tabular">{a.expected ? formatPercent((a.recovered / a.expected) * 100) : "—"}</span></p>
          </div>
        )}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer select-none font-medium text-primary">View as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-start text-[13px]">
            <thead className="text-muted">
              <tr>
                <th className="py-1.5 text-start font-medium">Month</th>
                <th className="py-1.5 text-end font-medium">Expected</th>
                <th className="py-1.5 text-end font-medium">Recovered</th>
                <th className="py-1.5 text-end font-medium">%</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {[...data].reverse().map((d) => (
                <tr key={d.month} className="border-t border-border">
                  <td className="py-1.5">{formatMonth(d.month, true)}</td>
                  <td className="py-1.5 text-end">{formatMoney(d.expected)}</td>
                  <td className="py-1.5 text-end">{formatMoney(d.recovered)}</td>
                  <td className="py-1.5 text-end">{d.expected ? formatPercent((d.recovered / d.expected) * 100) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
