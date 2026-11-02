/**
 * Calendar arithmetic on ISO dates ("YYYY-MM-DD"), done in UTC so there is
 * never a timezone shift. "Today" always comes from toPktDate().
 */
import { toPktDate } from "./format";

export type ISODate = string;

function parse(iso: ISODate): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}
function fmt(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export const todayPkt = (): ISODate => toPktDate(new Date());

export function addDays(iso: ISODate, n: number): ISODate {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

export function addMonths(iso: ISODate, n: number): ISODate {
  const d = parse(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() + n);
  return fmt(d);
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function isoWeekday(iso: ISODate): number {
  const wd = parse(iso).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function monthStart(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function monthEnd(iso: ISODate): ISODate {
  return addDays(addMonths(iso, 1), -1);
}

/** Monday of the week containing iso */
export function weekStart(iso: ISODate): ISODate {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && fmt(parse(s)) === s;
}

export type Calendar = {
  startDate: ISODate;
  endDate: ISODate;
  workingDays: number[];
  holidays: { startDate: ISODate; endDate: ISODate; name?: string }[];
};

export function holidayOn(cal: Calendar, iso: ISODate) {
  return cal.holidays.find((h) => h.startDate <= iso && iso <= h.endDate) ?? null;
}

/** BR-ORG-05: weekday in working days, not a holiday, inside the academic year. */
export function isWorkingDay(cal: Calendar, iso: ISODate): boolean {
  return (
    iso >= cal.startDate &&
    iso <= cal.endDate &&
    cal.workingDays.includes(isoWeekday(iso)) &&
    holidayOn(cal, iso) === null
  );
}

/** Working days in (from, to] — exclusive start, inclusive end (BR-TPR-05). */
export function workingDaysBetween(cal: Calendar, fromExclusive: ISODate, toInclusive: ISODate): number {
  if (toInclusive <= fromExclusive) return 0;
  let n = 0;
  for (let d = addDays(fromExclusive, 1); d <= toInclusive; d = addDays(d, 1)) if (isWorkingDay(cal, d)) n++;
  return n;
}

/** The last `count` working days ending at (and including) `end`. */
export function lastWorkingDays(cal: Calendar, end: ISODate, count: number): ISODate[] {
  const out: ISODate[] = [];
  for (let d = end; out.length < count && d >= cal.startDate; d = addDays(d, -1)) if (isWorkingDay(cal, d)) out.push(d);
  return out;
}

/** Add `n` working days after `from`. */
export function addWorkingDays(cal: Calendar, from: ISODate, n: number): ISODate {
  let d = from;
  let left = n;
  // Hard cap guards against a calendar with no working days.
  for (let guard = 0; left > 0 && guard < 3660; guard++) {
    d = addDays(d, 1);
    if (cal.workingDays.includes(isoWeekday(d)) && holidayOn(cal, d) === null) left--;
  }
  return d;
}
