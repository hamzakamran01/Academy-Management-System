import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { classSubjects, classSubjectTeachers, notifications, parentLinks, subjects } from "@/server/db/schema";
import { addDays, todayPkt } from "@/lib/dates";
import type { Ctx } from "@/server/auth/session";
import { classSubjectProgress, copySyllabus, getSyllabus, saveLessonLog, saveSyllabus, saveWeeklyPlan, getWeeklyPlan } from "@/server/modules/progress";
import { makeAcademy, makeClass, makeStudent, makeUser } from "./fixtures";

/** FR-TPR-01/05/08, BR-TPR-01/10/12/13/14 and "logging in 9-A doesn't change 9-B". */
describe("teaching progress service", () => {
  let admin: Ctx, teacher: Ctx, parent: Ctx;
  let csA = "", csB = "";

  beforeAll(async () => {
    const { academyId, yearId } = await makeAcademy();
    admin = await makeUser(academyId, "admin");
    teacher = await makeUser(academyId, "teacher", "Physics Teacher");
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
    await db.insert(parentLinks).values({ parentUserId: parent.userId, studentId: st.id, relation: "father" });
  });

  it("only the office edits the syllabus by default", async () => {
    await expect(saveSyllabus(teacher, csA, { books: [] })).rejects.toMatchObject({ status: 403 });
  });

  it("builds a syllabus (book → chapter → topic, sizes) and copies it", async () => {
    await saveSyllabus(admin, csA, {
      books: [
        {
          title: "Physics 9",
          chapters: [
            { title: "Ch 1 Measurements", targetDate: null, topics: [{ title: "Units", size: 2 }, { title: "Errors", size: 2 }] },
            { title: "Ch 2 Kinematics", targetDate: null, topics: [{ title: "Speed", size: 3 }, { title: "Graphs", size: 3 }] },
          ],
        },
      ],
    });
    const tree = await getSyllabus(teacher, csA);
    expect(tree[0]!.chapters.flatMap((c) => c.topics).reduce((n, t) => n + t.size, 0)).toBe(10);
    await copySyllabus(admin, csA, [csB]);
    expect((await getSyllabus(teacher, csB))[0]!.chapters).toHaveLength(2);
  });

  it("lesson logs drive topic status and coverage; 9-A doesn't change 9-B", async () => {
    const tree = await getSyllabus(teacher, csA);
    const [units, errors, speed] = tree[0]!.chapters.flatMap((c) => c.topics);
    await saveLessonLog(teacher, csA, {
      date: todayPkt(),
      topics: [
        { topicId: units!.id, status: "completed" },
        { topicId: errors!.id, status: "completed" },
        { topicId: speed!.id, status: "started" },
      ],
      homework: { title: "Exercise 1.1 Q1–5", dueDate: addDays(todayPkt(), 2) },
    });
    const a = await classSubjectProgress(teacher, csA);
    expect(a.progress.coverage).toBe(40); // 4 of 10
    expect(a.tree[0]!.chapters[1]!.topics[0]!.status).toBe("started");
    const b = await classSubjectProgress(teacher, csB);
    expect(b.progress.coverage).toBe(0);
    const n = await db.select().from(notifications).where(eq(notifications.userId, parent.userId));
    expect(n.map((x) => x.type)).toContain("homework.posted");
  });

  it("re-saving the same day upserts (one log per day) and recomputes", async () => {
    const tree = await getSyllabus(teacher, csA);
    const [units] = tree[0]!.chapters.flatMap((c) => c.topics);
    await saveLessonLog(teacher, csA, { date: todayPkt(), topics: [{ topicId: units!.id, status: "completed" }] });
    expect((await classSubjectProgress(teacher, csA)).progress.coverage).toBe(20);
  });

  it("dedupes offline replays by client id (BR-TPR-12)", async () => {
    const tree = await getSyllabus(teacher, csB);
    const t = tree[0]!.chapters[0]!.topics[0]!;
    const clientId = "7f1e3c1a-1111-4444-8888-000000000001";
    const one = await saveLessonLog(teacher, csB, { date: todayPkt(), topics: [{ topicId: t.id, status: "completed" }], clientId });
    const two = await saveLessonLog(teacher, csB, { date: todayPkt(), topics: [{ topicId: t.id, status: "completed" }], clientId });
    expect(two).toMatchObject({ id: one.id, duplicate: true });
  });

  it("closes the teacher edit window after 48 hours (BR-TPR-13)", async () => {
    const tree = await getSyllabus(teacher, csA);
    const t = tree[0]!.chapters[0]!.topics[0]!;
    await expect(saveLessonLog(teacher, csA, { date: addDays(todayPkt(), -3), topics: [{ topicId: t.id, status: "completed" }] })).rejects.toMatchObject({ status: 403 });
    await expect(saveLessonLog(admin, csA, { date: addDays(todayPkt(), -3), topics: [{ topicId: t.id, status: "completed" }] })).resolves.toBeTruthy();
  });

  it("weekly plan: save, submit, carry forward unfinished topics", async () => {
    const tree = await getSyllabus(teacher, csA);
    const ids = tree[0]!.chapters.flatMap((c) => c.topics).map((t) => t.id);
    const lastWeek = addDays(todayPkt(), -7);
    await saveWeeklyPlan(teacher, csA, lastWeek, { topicIds: ids, submit: true });
    const p = await getWeeklyPlan(teacher, csA, todayPkt());
    // Units is completed, the rest aren't → carried forward
    expect(p.carryForward.length).toBe(ids.length - 1);
  });
});
