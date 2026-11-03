import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { activityLog, classSubjects, classSubjectTeachers, notifications, parentLinks, subjects } from "@/server/db/schema";
import { todayPkt } from "@/lib/dates";
import type { Ctx } from "@/server/auth/session";
import {
  createAssessment,
  getMarksSheet,
  publishAssessment,
  saveMarks,
  studentResults,
  unlockAssessment,
} from "@/server/modules/results";
import { makeAcademy, makeClass, makeStudent, makeUser } from "./fixtures";

/** SRS §11.2 tests 8 (lock & correction) and 9 (validation), FR-RES-03/04/05. */
describe("results", () => {
  let admin: Ctx, teacher: Ctx, other: Ctx, parent: Ctx;
  let testId = "";
  const ids: string[] = [];

  beforeAll(async () => {
    const { academyId, yearId } = await makeAcademy();
    const owner = await makeUser(academyId, "super_admin");
    admin = await makeUser(academyId, "admin");
    teacher = await makeUser(academyId, "teacher", "Physics Teacher");
    other = await makeUser(academyId, "teacher", "Other Teacher");
    parent = await makeUser(academyId, "parent", "Parent");
    const cls = await makeClass(academyId, yearId, "9-A", { fee: 6000, setBy: owner.userId });
    const [sub] = await db.insert(subjects).values({ academyId, name: "Physics" }).returning();
    const [cs] = await db.insert(classSubjects).values({ classId: cls.id, subjectId: sub!.id }).returning();
    await db.insert(classSubjectTeachers).values({ classSubjectId: cs!.id, teacherId: teacher.userId, fromDate: "2026-04-01" });
    for (let i = 1; i <= 3; i++) ids.push((await makeStudent(academyId, cls.id, i, ["Ali", "Sara", "Omar"][i - 1])).id);
    await db.insert(parentLinks).values({ parentUserId: parent.userId, studentId: ids[0]!, relation: "father" });
    testId = (await createAssessment(teacher, { classSubjectId: cs!.id, type: "weekly", title: "Weekly Test 5", date: todayPkt(), totalMarks: 25 })).id;
  });

  it("only the subject teacher (or admin) can enter marks", async () => {
    await expect(saveMarks(other, testId, [{ studentId: ids[0]!, value: 10, absent: false }])).rejects.toMatchObject({ status: 403 });
  });

  it("validates per row and saves the valid rows (BR-RES-02)", async () => {
    const r = await saveMarks(teacher, testId, [
      { studentId: ids[0]!, value: 27, absent: false },
      { studentId: ids[1]!, value: 17.5, absent: false },
      { studentId: ids[2]!, value: 17.3, absent: false },
    ]);
    expect(r.saved).toBe(1);
    expect(r.errors.map((e) => e.message)).toEqual(["Max is 25", "Use whole or half marks"]);
  });

  it("publishes, locks and notifies parents (BR-RES-04)", async () => {
    await saveMarks(teacher, testId, [
      { studentId: ids[0]!, value: 18, absent: false },
      { studentId: ids[2]!, value: null, absent: true },
    ]);
    const res = await publishAssessment(teacher, testId);
    expect(res.notified).toBe(1);
    await expect(saveMarks(teacher, testId, [{ studentId: ids[0]!, value: 19, absent: false }])).rejects.toMatchObject({ status: 409 });
    const sheet = await getMarksSheet(teacher, testId);
    expect(sheet.stats).toMatchObject({ average: 17.8, highest: 18, lowest: 17.5, appeared: 2, absent: 1 });
    const [n] = await db.select().from(notifications).where(eq(notifications.userId, parent.userId));
    expect(n!.body).toContain("18/25");
    expect(n!.pushText).not.toMatch(/\d+\/25/); // no marks on the lock screen (BR-NOT-02)
  });

  it("unlock → correct 18 → 21 → republish shows Corrected and logs old/new (SRS 11.2 #8)", async () => {
    await expect(unlockAssessment(teacher, testId, "Typo")).rejects.toMatchObject({ status: 403 });
    await unlockAssessment(admin, testId, "Typo in Ali's marks");
    await saveMarks(teacher, testId, [{ studentId: ids[0]!, value: 21, absent: false }]);
    const res = await publishAssessment(teacher, testId);
    expect(res.notified).toBe(1);

    const [log] = await db.select().from(activityLog).where(and(eq(activityLog.entityId, testId), eq(activityLog.action, "mark.correct")));
    expect(log!.before).toMatchObject({ value: 18 });
    expect(log!.after).toMatchObject({ value: 21 });
    expect(log!.reason).toBe("Typo in Ali's marks");

    const view = await studentResults(parent, ids[0]!);
    expect(view.items[0]).toMatchObject({ value: 21, pct: 84, grade: "A", corrected: true });
    expect(view.items[0]!.position).toBeNull(); // position hidden from parents by default
    expect(view.items[0]!.classAverage).not.toBeNull(); // class average shown by default
  });

  it("parents can't see other children", async () => {
    await expect(studentResults(parent, ids[1]!)).rejects.toMatchObject({ status: 403 });
  });

  it("names a test automatically and marks blanks Absent on publish", async () => {
    const quick = await createAssessment(teacher, { classSubjectId: (await getMarksSheet(teacher, testId)).classSubjectId, type: "monthly", title: "", date: todayPkt(), totalMarks: 50 });
    const before = await getMarksSheet(teacher, quick.id);
    expect(before.title).toMatch(/^Monthly test · \d{2} [A-Z][a-z]{2}$/);
    await publishAssessment(teacher, quick.id);
    const after = await getMarksSheet(teacher, quick.id);
    expect(after.status).toBe("published");
    expect(after.rows.every((r) => r.isAbsent)).toBe(true);
  });
});
