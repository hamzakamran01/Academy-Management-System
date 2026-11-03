import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { classSubjects, classSubjectTeachers, homework, lessonLogs, notifications, parentLinks, subjects } from "@/server/db/schema";
import { addDays, todayPkt } from "@/lib/dates";
import type { Ctx } from "@/server/auth/session";
import { getDailyLog, homeworkForStudent, parentClassLog, saveDailyLog, teacherToday, teachingDay } from "@/server/modules/teaching";
import { makeAcademy, makeClass, makeStudent, makeUser } from "./fixtures";

/** The simple daily log: write what was taught (+ homework) or "no class". */
describe("daily teaching log", () => {
  let admin: Ctx, teacher: Ctx, other: Ctx, parent: Ctx;
  let csA = "", csB = "", studentId = "";
  const today = todayPkt();

  beforeAll(async () => {
    const { academyId, yearId } = await makeAcademy();
    admin = await makeUser(academyId, "admin");
    teacher = await makeUser(academyId, "teacher", "Physics Teacher");
    other = await makeUser(academyId, "teacher", "Other Teacher");
    parent = await makeUser(academyId, "parent");
    const owner = await makeUser(academyId, "super_admin");
    const a = await makeClass(academyId, yearId, "9-A", { fee: 1, setBy: owner.userId });
    const b = await makeClass(academyId, yearId, "9-B", { fee: 1, setBy: owner.userId });
    const [sub] = await db.insert(subjects).values({ academyId, name: "Physics" }).returning();
    csA = (await db.insert(classSubjects).values({ classId: a.id, subjectId: sub!.id }).returning())[0]!.id;
    csB = (await db.insert(classSubjects).values({ classId: b.id, subjectId: sub!.id }).returning())[0]!.id;
    await db.insert(classSubjectTeachers).values([
      { classSubjectId: csA, teacherId: teacher.userId, fromDate: "2026-04-01" },
      { classSubjectId: csB, teacherId: teacher.userId, fromDate: "2026-04-01" },
    ]);
    const st = await makeStudent(academyId, a.id, 1, "Ali");
    studentId = st.id;
    await db.insert(parentLinks).values({ parentUserId: parent.userId, studentId: st.id, relation: "father" });
  });

  it("requires something taught, or a no-class reason", async () => {
    await expect(saveDailyLog(teacher, csA, { date: today, taught: "  " })).rejects.toMatchObject({ code: "EMPTY_LOG" });
  });

  it("only the subject's teacher (or the office) can write it", async () => {
    await expect(saveDailyLog(other, csA, { date: today, taught: "x" })).rejects.toMatchObject({ status: 403 });
  });

  it("writes a log with homework and notifies parents; 9-B is untouched", async () => {
    const r = await saveDailyLog(teacher, csA, { date: today, taught: "Ch 1 — Units and measurement", homework: "Exercise 1.1 Q1–5" });
    expect(r.created).toBe(true);
    const got = await getDailyLog(teacher, csA, today);
    expect(got.log?.taught).toBe("Ch 1 — Units and measurement");
    expect(got.log?.homework).toBe("Exercise 1.1 Q1–5");
    const notes = await db.select().from(notifications).where(and(eq(notifications.userId, parent.userId), eq(notifications.type, "homework.posted")));
    expect(notes).toHaveLength(1);
    expect((await getDailyLog(teacher, csB, today)).log).toBeNull();
  });

  it("re-saving the same day updates it; unchanged homework doesn't re-notify", async () => {
    const r = await saveDailyLog(teacher, csA, { date: today, taught: "Ch 1 — Units, with examples", homework: "Exercise 1.1 Q1–5" });
    expect(r.created).toBe(false);
    expect(await db.select().from(lessonLogs).where(eq(lessonLogs.classSubjectId, csA))).toHaveLength(1);
    expect(await db.select().from(homework).where(eq(homework.classSubjectId, csA))).toHaveLength(1);
    const notes = await db.select().from(notifications).where(and(eq(notifications.userId, parent.userId), eq(notifications.type, "homework.posted")));
    expect(notes).toHaveLength(1);
  });

  it("no-class clears taught text and homework", async () => {
    await saveDailyLog(teacher, csB, { date: today, taught: "ignored", homework: "ignored", noClassReason: "test" });
    const got = await getDailyLog(teacher, csB, today);
    expect(got.log).toMatchObject({ taught: null, homework: null, noClassReason: "test" });
  });

  it("dedupes offline replays by client id", async () => {
    const clientId = crypto.randomUUID();
    const first = await saveDailyLog(teacher, csA, { date: addDays(today, -1), taught: "Revision", clientId });
    const again = await saveDailyLog(teacher, csA, { date: addDays(today, -1), taught: "Revision", clientId });
    expect(again).toMatchObject({ id: first.id, duplicate: true });
  });

  it("teachers can write for 2 days back, not older and not the future", async () => {
    await expect(saveDailyLog(teacher, csA, { date: addDays(today, -3), taught: "x" })).rejects.toMatchObject({ status: 403 });
    await expect(saveDailyLog(teacher, csA, { date: addDays(today, 1), taught: "x" })).rejects.toMatchObject({ code: "FUTURE_DATE" });
    await expect(saveDailyLog(admin, csA, { date: addDays(today, -3), taught: "Fixed by office" })).resolves.toBeTruthy();
  });

  it("shows up for the teacher, the office and the parent", async () => {
    const t = await teacherToday(teacher);
    expect(t.items.every((i) => i.log)).toBe(true);
    const day = await teachingDay(admin, today);
    expect(day).toMatchObject({ logged: 2, total: 2 });
    await expect(teachingDay(teacher, today)).rejects.toMatchObject({ status: 403 });
    const p = await parentClassLog(parent, studentId);
    expect(p.subjects[0]!.entries[0]!.taught).toBe("Ch 1 — Units, with examples");
    expect((await homeworkForStudent(parent, studentId))[0]!.text).toBe("Exercise 1.1 Q1–5");
  });
});
