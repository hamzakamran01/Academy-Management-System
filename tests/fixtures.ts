import { db } from "@/server/db";
import * as s from "@/server/db/schema";
import type { Ctx } from "@/server/auth/session";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { todayPkt } from "@/lib/dates";
import type { Role } from "@/lib/roles";

let phoneSeq = 1_000_000;
const nextPhone = () => `+92311${String(phoneSeq++).padStart(7, "0")}`;

export async function makeAcademy() {
  const today = todayPkt();
  const y = Number(today.slice(0, 4));
  const startYear = Number(today.slice(5, 7)) >= 4 ? y : y - 1;
  const [academy] = await db.insert(s.academy).values({ name: "Test Academy", settings: DEFAULT_SETTINGS }).returning();
  const [year] = await db
    .insert(s.academicYears)
    .values({ academyId: academy!.id, name: `${startYear}`, startDate: `${startYear}-04-01`, endDate: `${startYear + 1}-03-31`, isCurrent: true })
    .returning();
  return { academyId: academy!.id, yearId: year!.id, startYear };
}

export async function makeUser(academyId: string, role: Role, name = `${role} user`) {
  const [u] = await db.insert(s.users).values({ academyId, name, phone: nextPhone(), passwordHash: "x" }).returning();
  await db.insert(s.roleAssignments).values({ userId: u!.id, role });
  const ctx: Ctx = { sessionId: "test", userId: u!.id, academyId, role, roles: [role], name, phone: u!.phone };
  return ctx;
}

export async function makeClass(academyId: string, yearId: string, name: string, opts: { fee?: number; setBy?: string } = {}) {
  const [c] = await db.insert(s.classes).values({ academyId, academicYearId: yearId, name }).returning();
  if (opts.fee != null) await db.insert(s.classFees).values({ classId: c!.id, monthlyFee: opts.fee, setBy: opts.setBy! });
  return c!;
}

export async function makeStudent(academyId: string, classId: string, roll: number, name = `Student ${roll}`, fromDate = "2026-04-01") {
  const [st] = await db
    .insert(s.students)
    .values({ academyId, registrationNo: `T-${classId.slice(0, 4)}-${roll}-${Math.random().toString(36).slice(2, 7)}`, name, guardianName: "Guardian", gender: "male", admissionDate: fromDate })
    .returning();
  await db.insert(s.enrollments).values({ studentId: st!.id, classId, rollNo: String(roll), fromDate });
  return st!;
}
