import { addWorkingDays, lastWorkingDays, workingDaysBetween, type Calendar, type ISODate } from "./dates";

export type ProgressStatus = "on_track" | "at_risk" | "behind" | "no_targets" | "no_syllabus";

export type ChapterIn = { id: string; targetDate: ISODate | null };
export type TopicIn = { chapterId: string; size: number; status: "not_started" | "started" | "completed"; completedOn: ISODate | null };

export type Progress = {
  totalSize: number;
  completedSize: number;
  coverage: number | null; // %
  expected: number | null; // %
  difference: number | null; // percentage points
  status: ProgressStatus;
  remainingTopics: number;
  remainingSize: number;
  completedTopics: number;
  totalTopics: number;
  speed: number; // size per working day over the last 20 working days
  projectedFinish: ISODate | null;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * BR-TPR-05: expected coverage by today, interpolated over working days between
 * chapter target dates. `chapters` must be in syllabus order (book, chapter).
 * Chapters without a target inherit the next chapter's target, else the year end.
 */
export function expectedPercent(chapters: ChapterIn[], sizeByChapter: Map<string, number>, total: number, cal: Calendar, today: ISODate): number | null {
  if (total <= 0 || !chapters.some((c) => c.targetDate)) return null;
  const targets: ISODate[] = new Array(chapters.length);
  let next: ISODate = cal.endDate;
  for (let i = chapters.length - 1; i >= 0; i--) {
    next = chapters[i]!.targetDate ?? next;
    targets[i] = next;
  }
  let cum = 0;
  for (let i = 0; i < chapters.length; i++) {
    const size = sizeByChapter.get(chapters[i]!.id) ?? 0;
    if (targets[i]! >= today) {
      const prev = i === 0 ? cal.startDate : targets[i - 1]!;
      const denom = workingDaysBetween(cal, prev, targets[i]!);
      const fraction = denom === 0 ? 1 : Math.min(1, workingDaysBetween(cal, prev, today) / denom);
      return r1(((cum + size * fraction) / total) * 100);
    }
    cum += size;
  }
  return 100; // after the last target date
}

/**
 * BR-TPR-06 status. Boundary: a difference of exactly −behind is "Behind" —
 * this follows PRD §6.6 / SRS §11.2 #6 (55 vs 70 → Behind), which the
 * BR-TPR-06 wording contradicts at the boundary.
 */
export function statusFor(difference: number | null, thresholds: { atRisk: number; behind: number }): ProgressStatus {
  if (difference == null) return "no_targets";
  if (difference <= -thresholds.behind) return "behind";
  if (difference < -thresholds.atRisk) return "at_risk";
  return "on_track";
}

export function computeProgress(input: {
  chapters: ChapterIn[];
  topics: TopicIn[];
  cal: Calendar;
  today: ISODate;
  thresholds: { atRisk: number; behind: number };
}): Progress {
  const { chapters, topics, cal, today, thresholds } = input;
  const totalSize = topics.reduce((n, t) => n + t.size, 0);
  const done = topics.filter((t) => t.status === "completed");
  const completedSize = done.reduce((n, t) => n + t.size, 0);
  const sizeByChapter = new Map<string, number>();
  for (const t of topics) sizeByChapter.set(t.chapterId, (sizeByChapter.get(t.chapterId) ?? 0) + t.size);

  const coverage = totalSize > 0 ? r1((completedSize / totalSize) * 100) : null;
  const expected = expectedPercent(chapters, sizeByChapter, totalSize, cal, today);
  const difference = coverage != null && expected != null ? r1(coverage - expected) : null;
  const status: ProgressStatus = totalSize === 0 ? "no_syllabus" : statusFor(difference, thresholds);

  // BR-TPR-07: speed over the last 20 working days; projected finish.
  const window = lastWorkingDays(cal, today, 20);
  const from = window[window.length - 1];
  const recent = from ? done.filter((t) => t.completedOn && t.completedOn >= from && t.completedOn <= today).reduce((n, t) => n + t.size, 0) : 0;
  const speed = recent / 20;
  const remainingSize = totalSize - completedSize;
  const projectedFinish = remainingSize === 0 ? today : speed > 0 ? addWorkingDays(cal, today, Math.ceil(remainingSize / speed)) : null;

  return {
    totalSize,
    completedSize,
    coverage,
    expected,
    difference,
    status,
    remainingTopics: topics.length - done.length,
    remainingSize,
    completedTopics: done.length,
    totalTopics: topics.length,
    speed: r1(speed * 100) / 100,
    projectedFinish,
  };
}

/** BR-TPR-09: planned topics completed during the week ÷ planned topics. */
export function planCompletion(plannedTopicIds: string[], completedThisWeek: Set<string>): number | null {
  if (!plannedTopicIds.length) return null;
  return r1((plannedTopicIds.filter((id) => completedThisWeek.has(id)).length / plannedTopicIds.length) * 100);
}
