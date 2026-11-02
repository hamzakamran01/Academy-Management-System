import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { classSubjects, classSubjectTeachers, parentLinks, subjects } from "@/server/db/schema";
import { monthStart, todayPkt } from "@/lib/dates";
import type { Ctx } from "@/server/auth/session";
import { listActivity } from "@/server/modules/admin";
import { createAnnouncement, listAnnouncements } from "@/server/modules/announcements";
import { classFeeList, financeSummary, generateMonthRows, setClassFee, studentFeeRows } from "@/server/modules/fees";
import { listClasses } from "@/server/modules/org";
import { parentProgress } from "@/server/modules/progress";
import { buildReport } from "@/server/modules/reports";
import { setSalary } from "@/server/modules/salaries";
import { getStudentProfile, listStudents } from "@/server/modules/students";
import { createAccount } from "@/server/modules/users";
import { makeAcademy, makeClass, makeStudent, makeUser } from "./fixtures";

/**
 * NFR-SEC-04/05 permission suite: scoping per role and field-level DTO rules.
 * Every assertion here is a "right people see the right things" guarantee.
 */
describe("permissions & DTO rules", () => {
  let owner: Ctx, admin: Ctx, teacher: Ctx, otherTeacher: Ctx, parent: Ctx;
  let classA = "", classB = "", mine = "", notMine = "";
  const month = monthStart(todayPkt());

  beforeAll(async () => {
    const { academyId, yearId } = await makeAcademy();
    owner = await makeUser(academyId, "super_admin");
    admin = await makeUser(academyId, "admin");
    teacher = await makeUser(academyId, "teacher", "Teacher A");
    otherTeacher = await makeUser(academyId, "teacher", "Teacher B");
    parent = await makeUser(academyId, "parent");
    classA = (await makeClass(academyId, yearId, "9-A", { fee: 6000, setBy: owner.userId })).id;
    classB = (await makeClass(academyId, yearId, "9-B", { fee: 7000, setBy: owner.userId })).id;
    const [sub] = await db.insert(subjects).values({ academyId, name: "Maths" }).returning();
    const [csA] = await db.insert(classSubjects).values({ classId: classA, subjectId: sub!.id }).returning();
    const [csB] = await db.insert(classSubjects).values({ classId: classB, subjectId: sub!.id }).returning();
    await db.insert(classSubjectTeachers).values([
      { classSubjectId: csA!.id, teacherId: teacher.userId, fromDate: "2026-04-01" },
      { classSubjectId: csB!.id, teacherId: otherTeacher.userId, fromDate: "2026-04-01" },
    ]);
    mine = (await makeStudent(academyId, classA, 1, "Mine")).id;
    notMine = (await makeStudent(academyId, classB, 1, "Not mine")).id;
    await db.insert(parentLinks).values({ parentUserId: parent.userId, studentId: mine, relation: "mother" });
    await generateMonthRows(academyId, month, owner);
    await setClassFee(owner, classA, 6500, false); // finance_amount activity entry
    await setSalary(owner, teacher.userId, 50_000, month); // salary activity entry
  });

  it("account creation rights (PRD §3.2)", async () => {
    await expect(createAccount(admin, { name: "New Admin", phone: "03111111111", role: "admin" })).rejects.toMatchObject({ status: 403 });
    await expect(createAccount(teacher, { name: "X Parent", phone: "03111111112", role: "parent" })).rejects.toMatchObject({ status: 403 });
    await expect(createAccount(admin, { name: "New Teacher", phone: "03111111113", role: "teacher" })).resolves.toMatchObject({ created: true });
    await expect(createAccount(owner, { name: "New Admin", phone: "03111111114", role: "admin" })).resolves.toMatchObject({ created: true });
  });

  it("teachers see only students and classes they teach", async () => {
    const { items } = await listStudents(teacher, {});
    expect(items.map((s) => s.id)).toEqual([mine]);
    expect((await listClasses(teacher)).map((c) => c.id)).toEqual([classA]);
    await expect(getStudentProfile(teacher, notMine)).rejects.toMatchObject({ status: 403 });
    await expect(classFeeList(teacher, classB, month)).rejects.toMatchObject({ status: 403 });
  });

  it("teachers never receive private student fields or fee amounts", async () => {
    const p = await getStudentProfile(teacher, mine);
    expect(p.dob).toBeNull();
    expect(p.address).toBeNull();
    expect(p.notes).toBeNull();
    const fees = await studentFeeRows(teacher, mine);
    expect(JSON.stringify(fees)).not.toMatch(/"amount"/);
  });

  it("parents see only their own child", async () => {
    await expect(getStudentProfile(parent, mine)).resolves.toBeTruthy();
    await expect(getStudentProfile(parent, notMine)).rejects.toMatchObject({ status: 403 });
    await expect(studentFeeRows(parent, notMine)).rejects.toMatchObject({ status: 403 });
    await expect(parentProgress(parent, notMine)).rejects.toMatchObject({ status: 403 });
    await expect(listStudents(parent, {})).rejects.toMatchObject({ status: 403 });
    // parents do see amounts for their own child (Q2 default)
    expect((await studentFeeRows(parent, mine))[0]).toHaveProperty("amount");
  });

  it("revenue is owner-only, including exports (BR-DSH-02)", async () => {
    await expect(financeSummary(admin, month)).rejects.toMatchObject({ status: 403 });
    await expect(buildReport(admin, "finance", { month })).rejects.toMatchObject({ status: 403 });
    await expect(buildReport(admin, "salaries", { month })).rejects.toMatchObject({ status: 403 });
    await expect(buildReport(teacher, "unpaid", {})).rejects.toMatchObject({ status: 403 });
    const teacherFees = await buildReport(teacher, "fee-status", { classId: classA, month });
    expect(teacherFees.columns.map((c) => c.header).join()).not.toMatch(/Amount/);
  });

  it("admins don't see fee-amount or salary activity (BR-ADM-02)", async () => {
    const adminLog = await listActivity(admin, {});
    expect(adminLog.every((e) => e.sensitivity === "normal")).toBe(true);
    const ownerLog = await listActivity(owner, {});
    expect(ownerLog.some((e) => e.sensitivity === "salary")).toBe(true);
    expect(ownerLog.some((e) => e.sensitivity === "finance_amount")).toBe(true);
    await expect(listActivity(teacher, {})).rejects.toMatchObject({ status: 403 });
  });

  it("teachers announce only to their own classes (BR-NOT-04)", async () => {
    await expect(createAnnouncement(teacher, { title: "Test", body: "Hello all", audienceType: "all" })).rejects.toMatchObject({ status: 403 });
    await expect(createAnnouncement(teacher, { title: "Test", body: "Hello B", audienceType: "classes", classIds: [classB] })).rejects.toMatchObject({ status: 403 });
    const ok = await createAnnouncement(teacher, { title: "Quiz Friday", body: "Chapter 3 quiz", audienceType: "classes", classIds: [classA] });
    expect(ok.recipients).toBe(1); // the parent of the student in 9-A
    expect((await listAnnouncements(parent)).map((a) => a.title)).toContain("Quiz Friday");
    expect((await listAnnouncements(otherTeacher)).map((a) => a.title)).not.toContain("Quiz Friday");
  });
});
