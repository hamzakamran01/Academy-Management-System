/**
 * Display formats (UX-09): date `02 Nov 2026`, money `Rs 6,500`, 12-hour time,
 * all in Asia/Karachi. Pure functions — safe on server and client.
 */
export const TZ = "Asia/Karachi";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-02" → "02 Nov 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** "2026-11-02" → "Mon, 02 Nov" */
export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]}, ${String(d).padStart(2, "0")} ${MONTHS[m - 1]}`;
}

/** "2026-11-01" → "November 2026" */
export function formatMonth(iso: string, short = false): string {
  const [y, m] = iso.split("-");
  return `${(short ? MONTHS : MONTHS_LONG)[Number(m) - 1]} ${y}`;
}

/** Rs 6,500 — integer rupees (SRS C4). */
export function formatMoney(rupees: number | null | undefined): string {
  if (rupees == null) return "—";
  return `Rs ${Math.round(rupees).toLocaleString("en-PK")}`;
}

/** Rs 2.1M / Rs 350k for dense dashboard tiles. */
export function formatMoneyCompact(rupees: number): string {
  const abs = Math.abs(rupees);
  if (abs >= 10_000_000) return `Rs ${(rupees / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 100_000) return `Rs ${(rupees / 1000).toFixed(0)}k`;
  return formatMoney(rupees);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits).replace(/\.0$/, "")}%`;
}

/** 12-hour time in PKT: "10:05 am" */
export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-PK", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(date))
    .toLowerCase();
}

/** "02 Nov 2026, 10:05 am" */
export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return `${formatDate(toPktDate(d))}, ${formatTime(d)}`;
}

/** "just now", "5 min ago", "3 h ago", "yesterday", else the date. */
export function formatRelative(date: Date | string, now = new Date()): string {
  const d = new Date(date);
  const sec = Math.round((now.getTime() - d.getTime()) / 1000);
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86_400) return `${Math.round(sec / 3600)} h ago`;
  const days = Math.round(sec / 86_400);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(toPktDate(d));
}

/** The calendar date (YYYY-MM-DD) of an instant in Pakistan time. */
export function toPktDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-PK")} ${n === 1 ? one : many}`;
}

/** "Grade 9 – A" → "9A", "FSc Pre-Medical" → "FP": a compact visual anchor for a class tile. */
export function classBadge(name: string): string {
  const num = name.match(/\d{1,2}/)?.[0];
  const section = name.match(/[–-]\s*([A-Z])\b/)?.[1] ?? "";
  if (num) return `${num}${section}`;
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
