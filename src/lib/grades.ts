import type { GradeRow } from "./settings";

/** BR-RES-06: value ÷ total × 100, one decimal. */
export function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

/** BR-RES-06: first row (by descending min %) the percentage reaches. */
export function gradeFor(pct: number, scale: GradeRow[]): string {
  const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent);
  return sorted.find((g) => pct >= g.minPercent)?.grade ?? sorted[sorted.length - 1]?.grade ?? "—";
}

/** BR-RES-02: number with at most one decimal on a 0.5 step, 0 ≤ v ≤ total. */
export function markProblem(value: number, total: number): string | null {
  if (!Number.isFinite(value)) return "Enter a number";
  if (value < 0) return "Can't be negative";
  if (value > total) return `Max is ${total}`;
  if (Math.round(value * 2) !== value * 2) return "Use whole or half marks";
  return null;
}

export type MarkValue = { studentId: string; value: number | null; isAbsent: boolean };

/** BR-RES-07: class statistics exclude absent students. */
export function classStats(marks: MarkValue[], total: number, passPercent: number) {
  const present = marks.filter((m) => !m.isAbsent && m.value != null).map((m) => m.value!);
  if (!present.length) return { average: null, highest: null, lowest: null, passed: 0, appeared: 0, absent: marks.filter((m) => m.isAbsent).length };
  const avg = present.reduce((a, b) => a + b, 0) / present.length;
  return {
    average: Math.round(avg * 10) / 10,
    highest: Math.max(...present),
    lowest: Math.min(...present),
    passed: present.filter((v) => percentage(v, total) >= passPercent).length,
    appeared: present.length,
    absent: marks.filter((m) => m.isAbsent).length,
  };
}

/** BR-RES-08: standard competition ranking (1, 2, 2, 4) among non-absent students. */
export function positions(marks: MarkValue[]): Map<string, number> {
  const ranked = marks.filter((m) => !m.isAbsent && m.value != null).sort((a, b) => b.value! - a.value!);
  const out = new Map<string, number>();
  ranked.forEach((m, i) => {
    const prev = ranked[i - 1];
    out.set(m.studentId, prev && prev.value === m.value ? out.get(prev.studentId)! : i + 1);
  });
  return out;
}

/** Display a mark value: 17.5 → "17.5", 18 → "18". */
export const fmtMark = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
