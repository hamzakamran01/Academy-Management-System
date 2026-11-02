import { describe, expect, it } from "vitest";
import { computeProgress, expectedPercent, planCompletion, statusFor, type TopicIn } from "@/lib/progress";
import { workingDaysBetween, type Calendar } from "@/lib/dates";

const cal: Calendar = {
  startDate: "2026-04-01",
  endDate: "2027-03-31",
  workingDays: [1, 2, 3, 4, 5, 6],
  holidays: [{ startDate: "2026-06-01", endDate: "2026-07-31" }],
};
const T = { atRisk: 5, behind: 15 };

function topics(n: number, size: number, completed: number, chapterId = "c1", completedOn = "2026-10-20"): TopicIn[] {
  return Array.from({ length: n }, (_, i) => ({ chapterId, size, status: i < completed ? "completed" : "not_started", completedOn: i < completed ? completedOn : null }));
}

describe("teaching progress (BR-TPR-03…09, SRS 11.2 #6–7)", () => {
  it("coverage 66/120 = 55% (PRD acceptance)", () => {
    const p = computeProgress({ chapters: [{ id: "c1", targetDate: null }], topics: topics(60, 2, 33), cal, today: "2026-11-02", thresholds: T });
    expect(p.totalSize).toBe(120);
    expect(p.completedSize).toBe(66);
    expect(p.coverage).toBe(55);
    expect(p.status).toBe("no_targets");
    expect(p.remainingTopics).toBe(27);
    expect(p.remainingSize).toBe(54);
  });

  it("expected 70, coverage 55 → −15 → Behind; thresholds", () => {
    expect(statusFor(55 - 70, T)).toBe("behind");
    expect(statusFor(-14.9, T)).toBe("at_risk");
    expect(statusFor(-5, T)).toBe("on_track");
    expect(statusFor(-5.1, T)).toBe("at_risk");
    expect(statusFor(3, T)).toBe("on_track");
  });

  it("interpolates expected % over working days, skipping holidays", () => {
    const chapters = [
      { id: "a", targetDate: "2026-05-30" },
      { id: "b", targetDate: null }, // inherits c's target
      { id: "c", targetDate: "2026-12-31" },
    ];
    const sizes = new Map([["a", 30], ["b", 30], ["c", 40]]);
    // Before chapter a's target
    const d1 = "2026-05-02";
    const e1 = expectedPercent(chapters, sizes, 100, cal, d1)!;
    const frac1 = workingDaysBetween(cal, cal.startDate, d1) / workingDaysBetween(cal, cal.startDate, "2026-05-30");
    expect(e1).toBeCloseTo(Math.round(30 * frac1 * 10) / 10, 1);
    // Mid-holiday: no working days pass, so expected stays where chapter b began
    const atJune15 = expectedPercent(chapters, sizes, 100, cal, "2026-06-15")!;
    expect(atJune15).toBe(30);
    // Within chapter b (inherits 2026-12-31): fraction measured from a's target
    const d2 = "2026-11-02";
    const frac2 = workingDaysBetween(cal, "2026-05-30", d2) / workingDaysBetween(cal, "2026-05-30", "2026-12-31");
    expect(expectedPercent(chapters, sizes, 100, cal, d2)).toBeCloseTo(Math.round((30 + 30 * frac2) * 10) / 10, 1);
    // After the last target → 100
    expect(expectedPercent(chapters, sizes, 100, cal, "2027-01-15")).toBe(100);
    // No targets at all → null
    expect(expectedPercent([{ id: "a", targetDate: null }], sizes, 100, cal, d2)).toBeNull();
  });

  it("projects a finish date from the last 20 working days' speed", () => {
    const p = computeProgress({ chapters: [{ id: "c1", targetDate: null }], topics: topics(40, 1, 20, "c1", "2026-10-25"), cal, today: "2026-11-02", thresholds: T });
    expect(p.speed).toBe(1); // 20 size in 20 working days
    expect(p.projectedFinish).not.toBeNull();
    const stalled = computeProgress({ chapters: [{ id: "c1", targetDate: null }], topics: topics(40, 1, 20, "c1", "2026-08-01"), cal, today: "2026-11-02", thresholds: T });
    expect(stalled.speed).toBe(0);
    expect(stalled.projectedFinish).toBeNull();
  });

  it("plan completion 4 of 6 → 66.7% (started-only doesn't count)", () => {
    expect(planCompletion(["1", "2", "3", "4", "5", "6"], new Set(["1", "2", "3", "4"]))).toBe(66.7);
    expect(planCompletion([], new Set())).toBeNull();
  });
});
