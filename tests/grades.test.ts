import { describe, expect, it } from "vitest";
import { classStats, gradeFor, markProblem, percentage, positions } from "@/lib/grades";
import { DEFAULT_SETTINGS } from "@/lib/settings";

const scale = DEFAULT_SETTINGS.gradeScale;

describe("grades (BR-RES-02, 06, 07, 08)", () => {
  it("validates marks (SRS 11.2 test 9)", () => {
    expect(markProblem(27, 25)).toBe("Max is 25");
    expect(markProblem(17.5, 25)).toBeNull();
    expect(markProblem(17.3, 25)).not.toBeNull();
    expect(markProblem(-1, 25)).not.toBeNull();
    expect(markProblem(0, 25)).toBeNull();
    expect(markProblem(25, 25)).toBeNull();
  });

  it("computes percentage and grade", () => {
    expect(percentage(21, 25)).toBe(84);
    expect(gradeFor(84, scale)).toBe("A");
    expect(percentage(34, 40)).toBe(85);
    expect(gradeFor(90, scale)).toBe("A+");
    expect(gradeFor(39.9, scale)).toBe("F");
    expect(percentage(1, 3)).toBe(33.3);
  });

  it("excludes absent students from stats", () => {
    const s = classStats(
      [
        { studentId: "a", value: 20, isAbsent: false },
        { studentId: "b", value: 10, isAbsent: false },
        { studentId: "c", value: null, isAbsent: true },
        { studentId: "d", value: 5, isAbsent: false },
      ],
      25,
      40,
    );
    expect(s).toMatchObject({ average: 11.7, highest: 20, lowest: 5, passed: 2, appeared: 3, absent: 1 });
  });

  it("ranks with ties sharing a position", () => {
    const p = positions([
      { studentId: "a", value: 20, isAbsent: false },
      { studentId: "b", value: 22, isAbsent: false },
      { studentId: "c", value: 20, isAbsent: false },
      { studentId: "d", value: 18, isAbsent: false },
      { studentId: "e", value: null, isAbsent: true },
    ]);
    expect([p.get("b"), p.get("a"), p.get("c"), p.get("d"), p.get("e")]).toEqual([1, 2, 2, 4, undefined]);
  });
});
