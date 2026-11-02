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
        .values({ academyId, name, phone, passwordHash: withPassword ? passwordHash : null, lastActiveAt: withPassword ? new Date() : null })
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
        .values({ academyId, academicYearId: yearId, name: def.name, level: def.level, shift: def.shift, capacity: 40, classTeacherId: def.ct })
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

/** Syllabus, lesson logs, weekly plans, homework and a couple of published tests per class-subject. */
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
  const monday = addDays(today, 1 - (new Date(`${today}T00:00:00Z`).getUTCDay() || 7));
  const paces = [1.04, 0.97, 0.9, 1.08, 0.99, 0.84, 1.02, 0.7, 1.0];

  for (const [k, cs] of css.entries()) {
    const chapterDefs = SYLLABI[cs.subjectName] ?? SYLLABI.Physics!;
    const [book] = await tx.insert(s.books).values({ classSubjectId: cs.id, title: `${cs.subjectName} — Textbook`, order: 0 }).returning();
    const allTopics: { id: string; size: number; chapterIdx: number }[] = [];
    for (const [ci, def] of chapterDefs.entries()) {
      // Spread chapter targets across the year (skipping the summer break)
      const target = addDays(year.startDate, Math.round(((ci + 1) / chapterDefs.length) * 330));
      const [ch] = await tx.insert(s.chapters).values({ bookId: book!.id, title: `Ch ${ci + 1} · ${def[0]}`, order: ci, targetDate: target }).returning();
      const ts = await tx
        .insert(s.topics)
        .values(def.slice(1).map((title, ti) => ({ chapterId: ch!.id, title, order: ti, size: 1 + Math.floor(rand() * 3) })))
        .returning();
      ts.forEach((t) => allTopics.push({ id: t.id, size: t.size, chapterIdx: ci }));
    }

    // Expected share by today ≈ elapsed working days; each subject runs at its own pace.
    const elapsed = Math.min(1, (Date.parse(today) - Date.parse(year.startDate)) / 86_400_000 / 330);
    const pace = paces[k % paces.length]!;
    const doneCount = Math.min(allTopics.length - 1, Math.max(1, Math.round(allTopics.length * elapsed * pace)));
    const logDays = workingDays.slice(-Math.max(doneCount * 2, 10));
    for (let i = 0; i < doneCount; i++) {
      const date = logDays[Math.min(logDays.length - 1, Math.floor((i / doneCount) * logDays.length))]!;
      const [log] = await tx
        .insert(s.lessonLogs)
        .values({ classSubjectId: cs.id, teacherId: cs.teacherId, date })
        .onConflictDoNothing()
        .returning();
      const logId = log?.id ?? (await tx.select({ id: s.lessonLogs.id }).from(s.lessonLogs).where(and(eq(s.lessonLogs.classSubjectId, cs.id), eq(s.lessonLogs.date, date))))[0]!.id;
      await tx.insert(s.lessonLogTopics).values({ lessonLogId: logId, topicId: allTopics[i]!.id, status: "completed" });
      await tx.insert(s.topicProgress).values({ classSubjectId: cs.id, topicId: allTopics[i]!.id, status: "completed", completedOn: date });
    }
    // One topic in progress
    const started = allTopics[doneCount];
    if (started) await tx.insert(s.topicProgress).values({ classSubjectId: cs.id, topicId: started.id, status: "started" });

    // This week's plan for most subjects
    if (k % 4 !== 3) {
      const [plan] = await tx
        .insert(s.weeklyPlans)
        .values({ classSubjectId: cs.id, teacherId: cs.teacherId, weekStart: monday, status: k % 5 === 4 ? "draft" : "submitted", submittedAt: k % 5 === 4 ? null : new Date(`${monday}T04:30:00Z`), note: "Revise previous chapter on Saturday." })
        .returning();
      const next = allTopics.slice(doneCount, doneCount + 3);
      if (next.length) await tx.insert(s.weeklyPlanTopics).values(next.map((t) => ({ weeklyPlanId: plan!.id, topicId: t.id })));
    }
    // Homework due soon
    if (k % 2 === 0) {
      await tx.insert(s.homework).values({ classSubjectId: cs.id, title: `${cs.subjectName}: exercise questions 1–5`, details: "Write answers in your notebook.", dueDate: addDays(today, 1 + (k % 3)), createdBy: cs.teacherId });
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
