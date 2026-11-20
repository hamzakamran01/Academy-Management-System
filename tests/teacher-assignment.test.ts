import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { db } from "@/server/db";
import { classSubjects, classSubjectTeachers, subjects } from "@/server/db/schema";
import { assignTeacherFromProfile, removeClassSubject, teacherAssignmentOptions } from "@/server/modules/org";
import { teacherProfile } from "@/server/modules/users";
import { makeAcademy, makeClass, makeUser } from "./fixtures";

it("assigns, safely replaces and restores teaching assignments from the teacher profile", async () => {
  const { academyId, yearId } = await makeAcademy();
  const owner = await makeUser(academyId, "super_admin");
  const office = await makeUser(academyId, "admin");
  const first = await makeUser(academyId, "teacher");
  const second = await makeUser(academyId, "teacher");
  const cls = await makeClass(academyId, yearId, "Grade 9");
  const [subject] = await db.insert(subjects).values({ academyId, name: "Physics" }).returning();
  const input = { classId: cls.id, subjectId: subject!.id, previousTeacherId: null };

  await expect(assignTeacherFromProfile(office, first.userId, input)).rejects.toMatchObject({ status: 403 });
  await assignTeacherFromProfile(owner, first.userId, input);
  await assignTeacherFromProfile(owner, first.userId, input);
  const [assignment] = (await teacherProfile(owner, first.userId)).assignments;
  expect(assignment).toMatchObject({ classId: cls.id, subjectName: "Physics" });
  expect((await teacherAssignmentOptions(owner)).assignments).toContainEqual(
    expect.objectContaining({ classId: cls.id, subjectId: subject!.id, teacherId: first.userId }),
  );
  await expect(assignTeacherFromProfile(owner, second.userId, input)).rejects.toMatchObject({ code: "ASSIGNMENT_CHANGED" });
  await assignTeacherFromProfile(owner, second.userId, { ...input, previousTeacherId: first.userId });
  expect((await teacherProfile(owner, first.userId)).assignments).toEqual([]);
  expect((await teacherProfile(owner, second.userId)).assignments).toHaveLength(1);

  await removeClassSubject(owner, assignment!.classSubjectId);
  await assignTeacherFromProfile(owner, first.userId, input);
  const rows = await db.select().from(classSubjects)
    .where(and(eq(classSubjects.classId, cls.id), eq(classSubjects.subjectId, subject!.id)));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: assignment!.classSubjectId, archivedAt: null });
  const current = await db.select().from(classSubjectTeachers).where(eq(classSubjectTeachers.classSubjectId, assignment!.classSubjectId));
  expect(current.filter((entry) => entry.toDate === null).map((entry) => entry.teacherId)).toEqual([first.userId]);
});
