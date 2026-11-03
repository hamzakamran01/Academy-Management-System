/**
 * Realistic demo academy for local development and UI review.
 * Loaded automatically when DATABASE_URL="pglite://memory" (never on a real DB
 * unless explicitly run with `npm run db:seed -- --demo`).
 *
 * Demo sign-ins (password: Campusly#2026)
 *   Owner    0300 0000001     Admin   0300 0000002
 *   Teacher  0300 0000003     Parent  0300 0000004
 */
import { and, eq } from "drizzle-orm";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { addDays, addMonths, monthStart } from "@/lib/dates";
import { toPktDate } from "@/lib/format";
import { hashPassword } from "@/server/auth/crypto";
import type { Database } from "./connect";
import * as s from "./schema";

export const DEMO_PASSWORD = "Campusly#2026";

const BOYS = ["Ali", "Hamza", "Usman", "Bilal", "Ahmed", "Hassan", "Zain", "Saad", "Omar", "Danish", "Fahad", "Areeb", "Rayyan", "Taha", "Shayan", "Abdullah", "Haris", "Moiz"];
const GIRLS = ["Ayesha", "Fatima", "Zainab", "Hira", "Maryam", "Sana", "Iqra", "Areeba", "Mahnoor", "Laiba", "Eman", "Hafsa", "Noor", "Alishba", "Rida", "Anaya", "Kinza", "Minahil"];
const SURNAMES = ["Khan", "Ahmed", "Raza", "Malik", "Hussain", "Iqbal", "Sheikh", "Qureshi", "Butt", "Chaudhry", "Siddiqui", "Mirza", "Abbasi", "Farooq", "Javed"];
const FATHERS = ["Tariq", "Imran", "Kashif", "Nadeem", "Shahid", "Asif", "Khalid", "Javed", "Sohail", "Rashid", "Naveed", "Faisal", "Waqar", "Amir", "Zahid"];

/** Deterministic pseudo-random so every boot looks the same. */
function rng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

export async function seedDemo(db: Database): Promise<void> {
  const [existing] = await db.select({ id: s.academy.id }).from(s.academy).limit(1);
  if (existing) return;
  const rand = rng(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
  const today = toPktDate();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const startYear = Number(today.slice(5, 7)) >= 4 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1;

  await db.transaction(async (tx) => {
    const [academy] = await tx
      .insert(s.academy)
      .values({ name: "Campusly Demo Academy", address: "Main Boulevard, Gulberg III, Lahore", phone: "+924235770000", settings: DEFAULT_SETTINGS })
      .returning();
    const academyId = academy!.id;
    const [year] = await tx
      .insert(s.academicYears)
      .values({ academyId, name: `${startYear}–${String(startYear + 1).slice(2)}`, startDate: `${startYear}-04-01`, endDate: `${startYear + 1}-03-31`, isCurrent: true })
      .returning();
    const yearId = year!.id;

    await tx.insert(s.holidays).values([
      { academyId, academicYearId: yearId, name: "Summer vacation", startDate: `${startYear}-06-01`, endDate: `${startYear}-07-31` },
      { academyId, academicYearId: yearId, name: "Independence Day", startDate: `${startYear}-08-14`, endDate: `${startYear}-08-14` },
      { academyId, academicYearId: yearId, name: "Iqbal Day", startDate: `${startYear}-11-09`, endDate: `${startYear}-11-09` },
      { academyId, academicYearId: yearId, name: "Quaid Day & winter break", startDate: `${startYear}-12-25`, endDate: `${startYear + 1}-01-01` },
      { academyId, academicYearId: yearId, name: "Pakistan Day", startDate: `${startYear + 1}-03-23`, endDate: `${startYear + 1}-03-23` },
    ]);

    // ── Staff ──
    const mkUser = async (name: string, phone: string, roles: s.Role[], withPassword = true) => {
      const [u] = await tx
        .insert(s.users)
        .values({ academyId, name, phone, passwordHash: withPassword ? passwordHash : null, lastActiveAt: withPassword ? new Date() : null, lastLoginAt: withPassword ? new Date() : null })
        .returning();
      await tx.insert(s.roleAssignments).values(roles.map((role) => ({ userId: u!.id, role })));
      return u!;
    };
    const owner = await mkUser("Hamza Kamran", "+923000000001", ["super_admin"]);
    await mkUser("Bilal Ahmed", "+923000000002", ["admin"]);
    const ayesha = await mkUser("Ayesha Khan", "+923000000003", ["teacher"]);
    const usman = await mkUser("Usman Tariq", "+923000000005", ["teacher"]);
    const fatima = await mkUser("Fatima Noor", "+923000000006", ["teacher"]);
    const imran = await mkUser("Imran Siddiqui", "+923000000007", ["teacher"]);
    const sadia = await mkUser("Sadia Malik", "+923000000008", ["teacher"], false);

    // ── Subjects ──
    const subjNames = ["Physics", "Mathematics", "English", "Chemistry", "Biology", "Urdu", "Computer Science"];
    const subj = Object.fromEntries(
      (await tx.insert(s.subjects).values(subjNames.map((name) => ({ academyId, name, code: name.slice(0, 3).toUpperCase() }))).returning()).map((r) => [r.name, r.id]),
    ) as Record<string, string>;

    // ── Classes ──
    const classDefs = [
      { name: "Grade 9 – A", level: 9, shift: "Morning", ct: ayesha.id, fee: 6000, subjects: { Physics: ayesha, Mathematics: usman, English: fatima, Chemistry: imran, Urdu: sadia } },
      { name: "Grade 9 – B", level: 9, shift: "Morning", ct: usman.id, fee: 6000, subjects: { Physics: ayesha, Mathematics: usman, English: fatima, Chemistry: imran, "Computer Science": sadia } },
      { name: "Grade 10 – A", level: 10, shift: "Morning", ct: fatima.id, fee: 6500, subjects: { Physics: ayesha, Mathematics: usman, English: fatima, Chemistry: imran, Biology: sadia } },
      { name: "FSc Pre-Medical – Evening", level: 11, shift: "Evening", ct: imran.id, fee: 8000, subjects: { Physics: ayesha, Chemistry: imran, Biology: sadia, English: fatima } },
    ] as const;

    const parentPhones = new Map<string, string>(); // phone → userId
    let reg = 0;
    let phoneSeq = 1000;
    const thisMonth = monthStart(today);
    const lastMonth = addMonths(thisMonth, -1);

    for (const [ci, def] of classDefs.entries()) {
      const [cls] = await tx
        .insert(s.classes)
        .values({ academyId, academicYearId: yearId, name: def.name, level: def.level, shift: def.shift })
        .returning();
      await tx.insert(s.classFees).values({ classId: cls!.id, monthlyFee: def.fee, setBy: owner.id });
      for (const [subjectName, teacher] of Object.entries(def.subjects)) {
        const [cs] = await tx.insert(s.classSubjects).values({ classId: cls!.id, subjectId: subj[subjectName]! }).returning();
        await tx.insert(s.classSubjectTeachers).values({ classSubjectId: cs!.id, teacherId: teacher.id, fromDate: `${startYear}-04-01` });
      }

      const size = [14, 12, 13, 10][ci]!;
      for (let i = 0; i < size; i++) {
        const girl = rand() < 0.45;
        const surname = pick(SURNAMES);
        const father = `${pick(FATHERS)} ${surname}`;
        const name = `${pick(girl ? GIRLS : BOYS)} ${surname}`;
        reg++;
        const isDemoFamily = ci === 0 && i < 1;
        const [st] = await tx
          .insert(s.students)
          .values({
            academyId,
            registrationNo: `CL-${String(startYear).slice(2)}-${String(reg).padStart(4, "0")}`,
            name: isDemoFamily ? "Ali Raza" : name,
            guardianName: isDemoFamily ? "Raza Ahmed" : father,
            gender: isDemoFamily ? "male" : girl ? "female" : "male",
            admissionDate: `${startYear}-04-0${1 + (i % 5)}`,
            address: "Lahore",
          })
          .returning();
        await tx.insert(s.enrollments).values({ studentId: st!.id, classId: cls!.id, rollNo: String(i + 1), fromDate: `${startYear}-04-01` });

        // Parent account (the demo family shares one parent with a sibling in Grade 10)
        const phone = isDemoFamily ? "+923000000004" : `+92300${String(1000000 + phoneSeq++).slice(-7)}`;
        let parentId = parentPhones.get(phone);
        if (!parentId) {
          const p = await mkUser(isDemoFamily ? "Raza Ahmed" : father, phone, ["parent"], isDemoFamily || rand() < 0.7);
          parentId = p.id;
          parentPhones.set(phone, parentId);
        }
        await tx.insert(s.parentLinks).values({ parentUserId: parentId, studentId: st!.id, relation: "father" });

        // Fees: last month mostly paid, this month partly paid
        const paidLast = rand() < 0.88;
        const paidNow = rand() < 0.55;
        await tx.insert(s.feeRows).values([
          { academyId, studentId: st!.id, classId: cls!.id, month: lastMonth, amount: def.fee, status: paidLast ? "paid" : "unpaid", markedBy: paidLast ? def.ct : null, markedAt: paidLast ? new Date(`${lastMonth}T09:00:00Z`) : null },
          { academyId, studentId: st!.id, classId: cls!.id, month: thisMonth, amount: def.fee, status: paidNow ? "paid" : "unpaid", markedBy: paidNow ? def.ct : null, markedAt: paidNow ? new Date() : null },
        ]);
      }

      // Sibling for the demo parent
      if (ci === 2) {
        reg++;
        const [sib] = await tx
          .insert(s.students)
          .values({ academyId, registrationNo: `CL-${String(startYear).slice(2)}-${String(reg).padStart(4, "0")}`, name: "Sara Raza", guardianName: "Raza Ahmed", gender: "female", admissionDate: `${startYear}-04-01` })
          .returning();
        await tx.insert(s.enrollments).values({ studentId: sib!.id, classId: cls!.id, rollNo: String(size + 1), fromDate: `${startYear}-04-01` });
        await tx.insert(s.parentLinks).values({ parentUserId: parentPhones.get("+923000000004")!, studentId: sib!.id, relation: "father" });
        await tx.insert(s.feeRows).values([
          { academyId, studentId: sib!.id, classId: cls!.id, month: lastMonth, amount: def.fee, status: "paid", markedBy: def.ct, markedAt: new Date(`${lastMonth}T09:00:00Z`) },
          { academyId, studentId: sib!.id, classId: cls!.id, month: thisMonth, amount: def.fee, status: "unpaid" },
        ]);
      }
    }

    await tx
      .insert(s.registrationCounters)
      .values({ academyId, year: startYear, lastValue: reg })
      .onConflictDoNothing();
    // A sibling discount to show personal fees
    const [sara] = await tx.select({ id: s.students.id }).from(s.students).where(eq(s.students.name, "Sara Raza"));
    if (sara) await tx.insert(s.studentFees).values({ studentId: sara.id, monthlyFee: 5000, note: "Sibling discount", setBy: owner.id });

    await seedTeaching(tx as unknown as Database, { academyId, startYear, today, rand, ownerId: owner.id });

    // Announcements, a few notifications and activity so every screen has life in the demo
    const [hol] = await tx
      .insert(s.announcements)
      .values([
        { academyId, title: "Iqbal Day holiday — 9 November", body: "The academy will remain closed on Monday, 9 November for Iqbal Day. Classes resume on Tuesday.", audienceType: "all", pinned: true, authorId: owner.id, publishedAt: new Date(Date.now() - 2 * 3600_000) },
        { academyId, title: "Monthly tests next week", body: "Monthly tests for all classes start next Monday. Please make sure your child revises chapters covered this month.", audienceType: "parents", authorId: owner.id, publishedAt: new Date(Date.now() - 26 * 3600_000) },
        { academyId, title: "Staff meeting on Saturday", body: "All teachers please join the staff meeting at 1:30 pm on Saturday. Please keep writing your daily class logs.", audienceType: "teachers", authorId: owner.id, publishedAt: new Date(Date.now() - 50 * 3600_000) },
      ])
      .returning();
    const raza = (await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.phone, "+923000000004")))[0]!;
    await tx.insert(s.notifications).values([
      { userId: raza.id, role: "parent", type: "announcement", title: "Iqbal Day holiday — 9 November", body: "The academy will remain closed on Monday, 9 November for Iqbal Day.", link: `/announcements#a-${hol!.id}`, pushCancelledAt: new Date() },
      { userId: raza.id, role: "parent", type: "homework.posted", title: "English homework", body: "English: exercise questions 1–5 — due in 3 days", link: "/homework", pushCancelledAt: new Date(), createdAt: new Date(Date.now() - 5 * 3600_000) },
      { userId: raza.id, role: "parent", type: "fee.paid", title: "October fee received", body: "Ali Raza's fee for October is marked Paid.", link: "/fees", readAt: new Date(), pushCancelledAt: new Date(), createdAt: new Date(Date.now() - 30 * 86_400_000) },
      { userId: ayesha.id, role: "teacher", type: "reminder.lesson_log", title: "Write today's logs", body: "Physics · Grade 9 – A", link: "/home", pushCancelledAt: new Date() },
      { userId: owner.id, role: "super_admin", type: "system.monthly_rows", title: "Monthly lists created", body: "Fee rows and salary rows for this month were created automatically.", link: "/finance", pushCancelledAt: new Date() },
    ]);
    await tx.insert(s.activityLog).values([
      { academyId, actorId: owner.id, actorRole: "super_admin", action: "fee.class_set", entityType: "class", summary: "Set FSc Pre-Medical – Evening monthly fee to Rs 8,000", before: { monthlyFee: 7500 }, after: { monthlyFee: 8000 }, sensitivity: "finance_amount", at: new Date(Date.now() - 6 * 86_400_000) },
      { academyId, actorId: owner.id, actorRole: "super_admin", action: "student.add", entityType: "student", summary: "Added Sara Raza (CL-26) to Grade 10 – A", at: new Date(Date.now() - 4 * 86_400_000) },
      { academyId, actorId: ayesha.id, actorRole: "teacher", action: "assessment.publish", entityType: "assessment", summary: "Published Physics “Weekly test 4”", at: new Date(Date.now() - 7 * 86_400_000) },
      { academyId, actorId: ayesha.id, actorRole: "teacher", action: "fee_row.mark_paid", entityType: "fee_row", summary: "Marked paid: Abdullah Abbasi, November 2026", before: { status: "unpaid" }, after: { status: "paid" }, at: new Date(Date.now() - 3600_000) },
      { academyId, actorId: owner.id, actorRole: "super_admin", action: "salary.mark_paid", entityType: "salary_row", summary: "Paid October salary of Ayesha Khan", sensitivity: "salary", at: new Date(Date.now() - 2 * 86_400_000) },
    ]);

    // Salaries: teachers + one admin; last month paid, this month partly paid
    const staff = await tx
      .select({ id: s.users.id, role: s.roleAssignments.role })
      .from(s.users)
      .innerJoin(s.roleAssignments, eq(s.roleAssignments.userId, s.users.id))
      .where(and(eq(s.users.academyId, academyId)));
    const pay = staff.filter((x) => x.role === "teacher" || x.role === "admin");
    for (const [i, p] of pay.entries()) {
      const amount = p.role === "admin" ? 40_000 : 45_000 + (i % 4) * 5_000;
      await tx.insert(s.salarySettings).values({ userId: p.id, monthlySalary: amount, effectiveFrom: `${startYear}-04-01`, setBy: owner.id });
      await tx.insert(s.salaryRows).values([
        { academyId, userId: p.id, month: lastMonth, amount, status: "paid", paidOn: addDays(lastMonth, 30), markedBy: owner.id },
        { academyId, userId: p.id, month: thisMonth, amount, status: i % 3 === 0 ? "paid" : "pending", paidOn: i % 3 === 0 ? today : null, markedBy: i % 3 === 0 ? owner.id : null },
      ]);
    }
  });
}

const SYLLABI: Record<string, string[][]> = {
  Physics: [
    ["Physical quantities", "SI units", "Prefixes", "Scientific notation", "Measuring instruments"],
    ["Kinematics", "Distance & displacement", "Speed & velocity", "Acceleration", "Graphs of motion"],
    ["Dynamics", "Newton's first law", "Newton's second law", "Momentum", "Friction"],
    ["Turning effect of forces", "Moment of a force", "Equilibrium", "Centre of mass"],
    ["Gravitation", "Law of gravitation", "Mass of Earth", "Satellites"],
    ["Work & energy", "Work", "Kinetic energy", "Potential energy", "Power"],
  ],
  Mathematics: [
    ["Matrices", "Types of matrices", "Addition & subtraction", "Multiplication", "Inverse"],
    ["Real numbers", "Properties", "Radicals", "Exponents"],
    ["Logarithms", "Laws of logarithms", "Common logarithms", "Applications"],
    ["Algebraic expressions", "Formulas", "Surds", "Rationalisation"],
    ["Factorisation", "Factor theorem", "Cubic polynomials", "Remainder theorem"],
    ["Linear equations", "Solving equations", "Inequalities", "Graphs"],
  ],
  English: [
    ["The Saviour of Mankind", "Reading", "Vocabulary", "Comprehension"],
    ["Patriotism", "Reading", "Grammar: tenses", "Writing: essay"],
    ["Media and its impact", "Reading", "Grammar: voice", "Letter writing"],
    ["Daffodils (poem)", "Reading", "Poetic devices", "Summary"],
    ["Hazrat Asma", "Reading", "Grammar: narration", "Story writing"],
  ],
  Chemistry: [
    ["Fundamentals of chemistry", "Branches", "Atomic mass", "Mole concept", "Chemical equations"],
    ["Structure of atoms", "Atomic models", "Electronic configuration", "Isotopes"],
    ["Periodic table", "Periods & groups", "Periodic properties", "Trends"],
    ["Chemical bonding", "Ionic bond", "Covalent bond", "Metallic bond"],
    ["Physical states of matter", "Gases", "Liquids", "Solids"],
  ],
  Biology: [
    ["Introduction to biology", "Branches", "Levels of organisation"],
    ["Solving a biological problem", "Scientific method", "Data analysis"],
    ["Biodiversity", "Classification", "Five kingdoms", "Conservation"],
    ["Cells and tissues", "Cell structure", "Organelles", "Tissues"],
    ["Cell cycle", "Mitosis", "Meiosis", "Apoptosis"],
  ],
  Urdu: [["Nasr: Hamd", "Parhai", "Mushkil alfaaz"], ["Nazm: Iqbal", "Tashreeh", "Markazi khayal"], ["Qawaid", "Ism", "Fail"], ["Insha", "Khat", "Mazmoon"]],
  "Computer Science": [["Problem solving", "Algorithms", "Flowcharts"], ["Binary systems", "Number systems", "Conversions"], ["Networks", "Topologies", "Protocols"], ["Data & privacy", "Ethics", "Security"]],
};

/** Daily logs, homework and a couple of published tests per class-subject. */
async function seedTeaching(
  tx: Database,
  o: { academyId: string; startYear: number; today: string; rand: () => number; ownerId: string },
) {
  const { academyId, startYear, today, rand } = o;
  const year = { startDate: `${startYear}-04-01`, endDate: `${startYear + 1}-03-31` };
  const css = await tx
    .select({ id: s.classSubjects.id, classId: s.classSubjects.classId, subjectName: s.subjects.name, teacherId: s.classSubjectTeachers.teacherId })
    .from(s.classSubjects)
    .innerJoin(s.subjects, eq(s.subjects.id, s.classSubjects.subjectId))
    .innerJoin(s.classSubjectTeachers, eq(s.classSubjectTeachers.classSubjectId, s.classSubjects.id));
  const hol = await tx.select().from(s.holidays);
  const isWorking = (d: string) => {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    return wd !== 0 && !hol.some((h) => h.startDate <= d && d <= h.endDate);
  };
  const workingDays: string[] = [];
  for (let d = year.startDate; d <= today; d = addDays(d, 1)) if (isWorking(d)) workingDays.push(d);
  // How reliably each teacher writes the daily log (index by class-subject).
  const reliability = [1, 0.95, 0.85, 1, 0.9, 0.7, 1, 0.6, 0.95];
  const reasons = ["test", "revision", "event"] as const;

  for (const [k, cs] of css.entries()) {
    const chapterDefs = SYLLABI[cs.subjectName] ?? SYLLABI.Physics!;
    const lessons = chapterDefs.flatMap((def, ci) => def.slice(1).map((t) => `Ch ${ci + 1} · ${def[0]} — ${t}`));
    const rel = reliability[k % reliability.length]!;
    // Last 15 working days; today only for about half of the subjects (the day is still going).
    const days = workingDays.slice(-16).filter((d) => d !== today || k % 2 === 0);
    let topic = Math.floor(rand() * 4);
    for (const [di, date] of days.entries()) {
      if (date !== today && rand() > rel) continue; // missed day
      const noClass = di % 11 === 7 ? reasons[k % reasons.length]! : null;
      const taught = noClass ? null : `${lessons[topic % lessons.length]}${rand() < 0.4 ? ". Solved examples on the board." : ""}`;
      if (!noClass) topic++;
      const [log] = await tx
        .insert(s.lessonLogs)
        .values({ classSubjectId: cs.id, teacherId: cs.teacherId, date, note: taught, noLessonReason: noClass })
        .onConflictDoNothing()
        .returning();
      if (log && !noClass && (di + k) % 3 === 0) {
        await tx.insert(s.homework).values({
          classSubjectId: cs.id,
          lessonLogId: log.id,
          title: rand() < 0.5 ? "Exercise questions 1–5 in the notebook" : "Learn the definitions and do the end-of-section questions",
          dueDate: addDays(date, 1),
          createdBy: cs.teacherId,
        });
      }
    }

    // Two published weekly tests
    const roster = await tx.select({ id: s.enrollments.studentId }).from(s.enrollments).where(eq(s.enrollments.classId, cs.classId));
    for (const [ti, daysAgo] of [21, 7].entries()) {
      const date = workingDays[Math.max(0, workingDays.length - 1 - daysAgo)]!;
      const [a] = await tx
        .insert(s.assessments)
        .values({ academyId, classSubjectId: cs.id, type: "weekly", title: `Weekly test ${ti + 3}`, date, totalMarks: 25, status: "published", publishedAt: new Date(`${date}T10:00:00Z`), publishedBy: cs.teacherId, createdBy: cs.teacherId })
        .returning();
      await tx.insert(s.marks).values(
        roster.map((r) => {
          const absent = rand() < 0.05;
          return { assessmentId: a!.id, studentId: r.id, isAbsent: absent, value: absent ? null : Math.round((10 + rand() * 15) * 2) / 2, updatedBy: cs.teacherId };
        }),
      );
    }
  }
}
