# Campusly — Product Requirements Document (PRD)

> Version 1.1 (Core release baseline) · 2 Nov 2026 · Owner: Product
> Read with `docs/vision.md` (why) and `SRS.md` (system behaviour, data model, architecture).
> Requirement IDs (e.g. `FR-FEE-04`) are traced in `SRS.md`.

**Priority:** **M** = Must (release blocker) · **S** = Should (in R1 unless it threatens the date) · **C** = Could.
**Release 1 rule:** only the core modules below. Anything advanced is listed in §11 for later.

---

## Contents

1. Goals and non-goals
2. Assumptions and constraints
3. Roles and permissions
4. Navigation and home screens
5. UX requirements (mobile-first)
6. Functional requirements
   - 6.1 Accounts & Roles (AUTH)
   - 6.2 Academy Setup (ORG)
   - 6.3 Students (STU)
   - 6.4 Attendance (ATT)
   - 6.5 Results (RES)
   - 6.6 Teaching Progress (TPR)
   - 6.7 Fee Tracking (FEE)
   - 6.8 Teacher Salaries (SAL)
   - 6.9 Announcements & Notifications (NOT)
   - 6.10 Dashboards & Reports (DSH)
   - 6.11 Activity Log & Settings (ADM)
7. Key user journeys
8. Screen list by role
9. Notifications
10. Non-functional requirements (summary)
11. Release plan and later roadmap
12. Risks
13. Open questions
- Appendix A — Glossary · Appendix B — Defaults · Appendix C — References

---

## 1. Goals and non-goals

### 1.1 Goals
| # | Goal | Measure |
|---|---|---|
| G1 | Parents see attendance, results, teaching progress, homework and fee status for their children. | ≥ 80% parents logged in; ≥ 50% weekly active |
| G2 | Teachers do attendance, marks, weekly plan, lesson log and fee marking on their phones. | ≥ 90% lesson-log days; ≥ 95% attendance same day |
| G3 | Admin runs students, classes and fee status without spreadsheets. | No parallel Excel needed after month 1 |
| G4 | Super Admin sees students, fees (expected / recovered / pending), salaries and teacher progress in one place. | Monthly fee check matches 100% |
| G5 | Every number is correct and every important change is traceable. | 100% of fee marks, mark edits and student removals in activity log |

### 1.2 Non-goals for Release 1
Online payments or payment gateways · invoices, receipts, late fines, concessions workflows · SMS/WhatsApp automated messages · parent–teacher chat · timetable builder · multiple branches · student logins · payroll processing (payslips, deductions) · expenses/accounting · approval workflows · app-store apps.

---

## 2. Assumptions and constraints

| ID | Assumption |
|---|---|
| A1 | One academy, one location. (Multiple branches later — the data model keeps an `academy_id` so this can be added.) |
| A2 | Up to **3,000 active students**, **150 teachers**, **10 admins** in R1, with headroom of 3×. |
| A3 | One **academic year** is "current" at a time (e.g. Apr 2026 – Mar 2027). |
| A4 | A **class** is the teaching group students sit in (e.g. "Grade 9 – A", "FSc Part-I Pre-Medical – Evening"). Each class has subjects, and each class-subject has one teacher. |
| A5 | By default a student studies all subjects of their class; an admin can untick subjects the student doesn't take (common in academies). |
| A6 | Fees are **monthly**. Each student has one monthly fee amount (class default, or a personal amount set by the Super Admin). |
| A7 | Fee collection happens outside the app (cash/bank/wallet); the app only **tracks status** Paid / Unpaid. |
| A8 | Everyone has a mobile number; most use Android phones. |
| A9 | UI language in R1 is English with all text prepared for translation; Urdu interface is R1.1 (names and free text can be typed in Urdu from day one). |

**Constraints:** installable web app (PWA) for Android and iPhone; must work on weak 3G/4G; no paid messaging in R1; students are minors, so their data must be private and protected.

---

## 3. Roles and permissions

### 3.1 Role summary
| Role | Scope |
|---|---|
| **Super Admin** | Whole academy. Full control. Only role for **fee amounts**, **teacher salaries**, **revenue figures**, and **admin accounts**. |
| **Admin** | Whole academy, operations only. No fee amounts setting, no salaries, no revenue totals, cannot manage Super Admin or other Admin accounts. |
| **Teacher** | Only the classes and subjects assigned to them in the current year. A teacher can also be **class teacher** (in-charge) of one class, which adds daily attendance for that class. |
| **Parent** | Only their linked children. |

A person can hold two roles (e.g. a teacher whose child studies at the academy). They switch role from the profile menu; data never mixes.

### 3.2 Permission matrix

Legend: ✅ full · 👁 view only · 🔸 only own classes/subjects · 👪 only own children · 🙋 only own record · ❌ no access

| Capability | Super Admin | Admin | Teacher | Parent |
|---|---|---|---|---|
| Create/disable **Admin** accounts | ✅ | ❌ | ❌ | ❌ |
| Create/disable Teacher & Parent accounts | ✅ | ✅ | ❌ | ❌ |
| Academic year, holidays | ✅ | ✅ | 👁 | 👁 (holidays) |
| Add / edit / remove **classes** | ✅ | ✅ | 👁 🔸 | ❌ |
| Subjects & assign teachers to class-subjects | ✅ | ✅ | 👁 🔸 | ❌ |
| Add / edit / move / remove / re-admit **students** | ✅ | ✅ | 👁 🔸 (names, roll no., parent phone) | 👁 👪 |
| Mark attendance | ✅ | ✅ (any class) | 🔸 (class teacher's class) | ❌ |
| View attendance | ✅ | ✅ | 🔸 | 👪 |
| Create tests, enter marks, publish | ✅ | ✅ (correct/unlock) | 🔸 | ❌ |
| View results | ✅ | ✅ | 🔸 | 👪 (published only) |
| Syllabus (book → chapter → topic) | ✅ | ✅ | 🔸 edit (S) / view | 👁 👪 progress only |
| Weekly plan & lesson log | 👁 + comment | 👁 + comment | 🔸 create/edit | 👁 👪 (topics taught, homework) |
| Teaching-progress dashboard (all teachers) | ✅ | ✅ | 🙋 own | ❌ |
| **Set monthly fee** (class default & per student) | ✅ | ❌ | ❌ | ❌ |
| See a student's fee **amount** | ✅ | 👁 | ❌ | 👪 |
| **Mark fee Paid / Unpaid** | ✅ | ✅ (any student) | 🔸 (students of classes they teach) | ❌ |
| See who paid / not paid, counts remaining | ✅ | ✅ | 🔸 | 👪 own status |
| Waive a month's fee | ✅ | ❌ | ❌ | ❌ |
| **Revenue figures** (expected, recovered, pending in Rs) | ✅ | ❌ | ❌ | ❌ |
| **Set / see teacher salaries** | ✅ all | ❌ | 🙋 own only | ❌ |
| Mark salary Paid for a month | ✅ | ❌ | 🙋 see own status | ❌ |
| Announcements | ✅ all audiences | ✅ all audiences | 🔸 own classes | 👁 |
| Activity log | ✅ | 👁 (excluding salary & fee-amount changes) | ❌ | ❌ |
| Settings | ✅ | ❌ | ❌ | ❌ |
| Reports & export | ✅ all | ✅ (no revenue/salary) | 🔸 own classes | 👪 |

**Enforcement rule:** every permission above is checked on the server for every request — hiding a button is never the only protection. Salary data and revenue totals are never sent to Admin, Teacher (except own salary) or Parent devices.

---

## 4. Navigation and home screens

### 4.1 Bottom navigation (phone)
| Role | Tab 1 | Tab 2 | Tab 3 | Tab 4 | Tab 5 |
|---|---|---|---|---|---|
| Parent | **Home** | **Results** | **Progress** (syllabus & homework) | **Fees** | **More** |
| Teacher | **Today** | **My Classes** | **Results** | **Fees** | **More** |
| Admin | **Dashboard** | **Students** | **Classes** | **Fees** | **More** |
| Super Admin | **Overview** | **Students** | **Finance** | **Teachers** | **More** |

"More" holds: attendance history, announcements, holidays/calendar, reports, settings, profile, role switch, logout.
On desktop (≥ 1024 px) the same items appear as a left sidebar with wider tables.

### 4.2 Home screens answer the top questions without scrolling
| Role | Home shows |
|---|---|
| **Parent** | Child switcher (if more than one) · Today: Present/Absent · Latest result · This month's fee: Paid/Unpaid · "This week" — topics taught per subject + homework · latest announcement |
| **Teacher** | My classes today with quick buttons: **Mark attendance** (class teacher), **Log lesson**, **Add result**, **Fee status** · Pending: weekly plan due, lesson logs missing, unpublished tests · Syllabus status per class (On track / Behind) |
| **Admin** | Students: total active, added/removed this month · Today's attendance: marked/unmarked classes, absent count · Fees this month: paid count vs unpaid count (no Rs totals) · Teachers with missing plans/logs · Tests awaiting publish |
| **Super Admin** | Total active students · **Expected revenue this month · Recovered · Pending · Recovery %** · Salaries this month (total, paid, pending) · Attendance today · Teaching progress: classes On track / At risk / Behind · Teachers needing attention |

---

## 5. UX requirements (mobile-first)

| # | Requirement | Pri |
|---|---|---|
| UX-01 | Designed first for 360 × 640 px Android screens; works up to desktop. | M |
| UX-02 | Touch targets ≥ 48 × 48 px; main action button fixed at the bottom of the screen within thumb reach. | M |
| UX-03 | Every list screen has search and simple filters (class, status). | M |
| UX-04 | Status always shown with text + colour + icon (e.g. ✅ Paid, ⏳ Unpaid) — never colour alone. | M |
| UX-05 | Every screen has a loading skeleton, an empty state with a helpful action, and a clear error with **Retry**. | M |
| UX-06 | Drafts (attendance, marks, lesson log, weekly plan) save automatically on the phone; nothing is lost if the network drops or the app closes. | M |
| UX-07 | When offline, the app shows an "Offline — will send when connected" banner and sends queued entries automatically when back online. | S |
| UX-08 | Confirmation sheet for destructive actions (remove student, remove class, unlock result) explaining the effect. Undo (5 s) for quick toggles like fee Paid. | M |
| UX-09 | Formats: date `02 Nov 2026`; money `Rs 6,500`; time 12-hour; timezone Pakistan (Asia/Karachi). | M |
| UX-10 | Accessible: readable at large system font sizes, good contrast (WCAG 2.2 AA), labels for screen readers. | M |
| UX-11 | Installable to home screen; on iPhone show a short "Add to Home Screen" guide (needed for notifications). | M |
| UX-12 | Light and dark mode follow the phone setting. | S |
| UX-13 | Urdu interface with right-to-left layout. | S (R1.1) |

### 5.1 Key interaction patterns (Must)

**Quick attendance** — class list sorted by roll number, everyone starts as **Present**; tap a name to switch to **Absent**, tap again for **Late**, again for **Leave**. Counter at the bottom ("38 Present · 2 Absent · 1 Late") and one **Save** button. Target: 40 students in under 30 seconds.

**Marks in front of names** — test header (subject, class, total marks, entered 27/41). Each row: roll no. · name · marks box. Phone number-pad opens; **Next** jumps to the next student. Buttons for **Absent (A)**. Marks above the total are rejected with a message. Live class average at the bottom. **Save draft** and **Publish**.

**Two-tap lesson log** — from Today, tap the class-subject → topics from this week's plan are pre-listed → tick each as **Started** or **Completed** → optional homework → **Save**.

**Fee marking in class** — teacher opens **Fees → [Class] → [Month]**. List shows each student with a large toggle **Paid / Unpaid**. Top shows "Paid 31 · Unpaid 9 · Remaining 9". Filter: Unpaid only. Tap toggles immediately with a 5-second **Undo**. The teacher never sees amounts.

---

## 6. Functional requirements

### 6.1 Accounts & Roles (AUTH)

**Stories:** As an admin, I create a parent account using the parent's phone number when I add a student, and share the login link through my WhatsApp. As any user, I log in with my phone number and password and stay logged in on my phone. As a Super Admin, I am the only one who can create admin accounts.

| ID | Requirement | Pri |
|---|---|---|
| FR-AUTH-01 | Login with mobile number (Pakistan format, stored as `+92…`) and password. | M |
| FR-AUTH-02 | Account creation by authorised roles (see §3.2). The system creates a **one-time setup link** (valid 7 days). The creator can copy it or tap **Share on WhatsApp** (opens their WhatsApp with a pre-written message — no paid API). | M |
| FR-AUTH-03 | First login via setup link: user sets their own password (min 8 characters). | M |
| FR-AUTH-04 | Forgot password: Admin/Super Admin can generate a new setup link for a user. (Self-service SMS OTP reset is R2.) | M |
| FR-AUTH-05 | Stay signed in: Parent & Teacher 60 days; Admin 14 days; Super Admin 7 days. Logout and "log out of all devices" available. | M |
| FR-AUTH-06 | Lock account for 15 minutes after 5 wrong passwords. | M |
| FR-AUTH-07 | Role switch for users holding two roles. | M |
| FR-AUTH-08 | Super Admin can deactivate/reactivate any account; Admin can deactivate/reactivate Teacher and Parent accounts. A deactivated user is logged out everywhere within 1 minute. | M |
| FR-AUTH-09 | One parent account can be linked to several children (siblings). Each child can have up to 2 parent accounts (e.g. father and mother). | M |
| FR-AUTH-10 | Profile: name, phone, photo (optional), change password. | M |

**Acceptance:** *Given* a parent with two children, *when* they log in, *then* both children appear in the switcher and no other student's data is reachable through any screen or API.

---

### 6.2 Academy Setup (ORG)

**Stories:** As an admin, I create this year's classes, add subjects to each class, assign a teacher to each subject, and choose a class teacher. I can remove a class that's no longer running. I add holidays so attendance and syllabus pace ignore them.

| ID | Requirement | Pri |
|---|---|---|
| FR-ORG-01 | Academy profile (name, logo, address, phone) — Super Admin. | M |
| FR-ORG-02 | Academic year with start and end date; one current year. Starting a new year can **copy classes, subjects, teacher assignments and syllabus** from the previous year. | M |
| FR-ORG-03 | Working days of the week (default Mon–Sat). | M |
| FR-ORG-04 | **Add class:** name, level/grade (for ordering), optional shift (Morning/Evening), class teacher, optional capacity. | M |
| FR-ORG-05 | **Subjects:** academy-wide subject list (e.g. Physics, Math); attach subjects to a class. | M |
| FR-ORG-06 | **Assign teacher** to each class-subject (one teacher per class-subject; changing the teacher keeps history of who taught when). | M |
| FR-ORG-07 | **Remove class:** allowed only when the class has no active students — the screen shows how many students need to be moved first and offers **Move students** to another class. Removed classes are archived (history stays: attendance, results, fees). | M |
| FR-ORG-08 | Holidays: date or date range with name; visible to all; excluded from attendance and syllabus pace. | M |
| FR-ORG-09 | Default monthly fee per class — **Super Admin only** (see FEE). | M |

**Acceptance:** *Given* class "9-A" with 35 active students, *when* the admin taps Remove, *then* removal is blocked with "35 students are still in this class — move them first" and a **Move students** button.

---

### 6.3 Students (STU)

**Stories:** As an admin, I add a new student, link the parent (reusing the parent account if a sibling is already enrolled), and the parent can log in the same day. I can move a student to another class, remove a student who left, and re-admit them later with history intact.

| ID | Requirement | Pri |
|---|---|---|
| FR-STU-01 | **Add student:** full name, father's/guardian's name, gender, date of birth (optional), photo (optional), class, roll number (auto-suggest next, editable), admission date, parent phone(s), address (optional), notes (optional). Registration number generated automatically (e.g. `CL-26-0042`). | M |
| FR-STU-02 | **Parent linking:** entering a phone that already belongs to a parent links the existing account (sibling) instead of creating a duplicate; otherwise a new parent account and setup link are created. | M |
| FR-STU-03 | **Subjects:** student takes all class subjects by default; admin can untick subjects not taken. Teachers only see a student in the subjects they take. | M |
| FR-STU-04 | **Edit student** details; roll numbers unique within a class. | M |
| FR-STU-05 | **Move class:** choose new class and date; old attendance/results stay in history; new class's teachers see the student from that date. | M |
| FR-STU-06 | **Remove student** (left/withdrawn): reason (Left, Completed, Transferred, Expelled, Other + note) and leaving date. Student disappears from attendance, marks and fee lists from the next day/month; history kept. If any months are **Unpaid**, the screen warns "2 months unpaid (shown to Super Admin)". Parent can still log in **read-only for 30 days**, then access stops (unless they have another active child). | M |
| FR-STU-07 | **Re-admit** a removed student into any class; keeps the same registration number and history. | M |
| FR-STU-08 | **Permanent delete** only by Super Admin, only for a student added by mistake with no attendance, marks or fee marks; typed confirmation. | M |
| FR-STU-09 | Student list: search by name, roll no., registration no., parent phone; filter by class, status (Active / Removed), fee status this month. | M |
| FR-STU-10 | Student profile tabs: Details · Attendance · Results · Teaching progress (class) · Fees (status by month; amounts visible to Admin & Super Admin) · History. | M |
| FR-STU-11 | **Bulk add** students from an Excel/CSV template with a check-before-import screen (errors per row). | S |
| FR-STU-12 | **Promote** at year end: for each class pick the next class; tick students to promote, keep back or remove. | M |

**Acceptance:**
- *Given* a student removed on 15 Nov, *then* they don't appear in attendance from 16 Nov or in the December fee list, but their November fee row and all results stay visible in history.
- *Given* a parent phone already linked to an active student, *when* a sibling is added with that phone, *then* no new account is created and the new child appears in the parent's switcher.

---

### 6.4 Attendance (ATT)

**Stories:** As a class teacher, I mark daily attendance in seconds. As a parent, I'm notified if my child is absent. As an admin, I see which classes haven't marked attendance and who is absent today.

| ID | Requirement | Pri |
|---|---|---|
| FR-ATT-01 | **Daily attendance per class**, marked by the class teacher (or Admin/Super Admin for any class). | M |
| FR-ATT-02 | Statuses: **Present, Absent, Late, Leave**. Quick-attendance pattern (§5.1). | M |
| FR-ATT-03 | Marking is blocked on holidays and non-working days (with message). | M |
| FR-ATT-04 | Teacher can edit the same day; after that only Admin/Super Admin can edit (logged). | M |
| FR-ATT-05 | Parent gets an in-app + push notification when the child is marked **Absent** (and Late, if enabled). | M |
| FR-ATT-06 | Parent view: month calendar with colours + labels, attendance % for the month and the year. | M |
| FR-ATT-07 | Admin view: today — classes marked / not marked, absent list; monthly register per class (printable/exportable). | M |
| FR-ATT-08 | Reminder to class teacher if attendance isn't marked by a set time (default 11:00). | S |
| FR-ATT-09 | Per-subject attendance (each subject period) — setting, off by default. | C |

---

### 6.5 Results (RES)

**Stories:** As a teacher, I create a test for my class-subject, type marks in front of each student's name and publish. As a parent, I see my child's marks, percentage and how they're trending. As an admin, I can correct a mistake after publishing, and the parent sees it was corrected.

| ID | Requirement | Pri |
|---|---|---|
| FR-RES-01 | **Create test/exam:** class-subject, type (Weekly test, Monthly test, Mid-term, Final, Other), title, date, total marks, optional chapters covered (from syllabus). | M |
| FR-RES-02 | Admin can create an **exam for a whole class** (e.g. "Mid-term") which creates one test per subject for the respective teachers. | S |
| FR-RES-03 | **Marks entry in front of names** (§5.1): only students taking that subject; values 0 … total (half marks allowed, e.g. 17.5); **A = Absent**; autosave draft. | M |
| FR-RES-04 | **Publish**: teacher publishes when all students have a value (marks or A). Published results are visible to parents immediately and they get a notification. | M |
| FR-RES-05 | Published results are **locked**. To correct, Admin/Super Admin unlocks with a reason; the teacher (or admin) edits and republishes; the parent sees "Corrected on <date>"; old and new values are logged. Teachers can request a correction. | M |
| FR-RES-06 | Per test, staff see: class average, highest, lowest, number passed (pass % configurable, default 40%). | M |
| FR-RES-07 | Parent sees per test: marks / total, percentage, grade; class average (setting, default on); position in class (setting, default off). | M |
| FR-RES-08 | Grade scale configurable by Super Admin (default in Appendix B). | M |
| FR-RES-09 | Subject summary per student: all tests listed with a simple trend line; overall average % per subject and across subjects for the year. | M |
| FR-RES-10 | Class result sheet (students × tests) per subject, and per exam (students × subjects) — view, print, export. | M |
| FR-RES-11 | Reminder to teacher about tests older than 3 days that are not published. | S |
| FR-RES-12 | Printable report card per student per exam (PDF). | S (R1.1) |

**Acceptance:**
- *Given* total marks 25, *when* the teacher types 27, *then* the box shows "Max is 25" and the value isn't saved.
- *Given* a published mark is corrected from 18 to 21, *then* the parent sees 21 with "Corrected", and the activity log shows 18 → 21, who, when and why.

---

### 6.6 Teaching Progress (TPR) — syllabus, weekly plan, lesson log, homework

**Concepts (kept simple):**
- **Syllabus** for each class-subject: **Book → Chapter → Topic**. Each chapter can have a **target finish date** (optional). Each topic has a **size** (number of periods, default 1) so bigger topics count more.
- **Weekly plan**: the topics the teacher plans to teach this week, per class-subject, plus a short note.
- **Lesson log**: what was actually taught on a day — topics ticked as **Started** or **Completed**, optional page/exercise, optional note, optional homework.
- **Coverage %** = size of completed topics ÷ size of all topics.
- **Remaining** = topics not completed (count and periods).
- **Expected %** = what should be done by today based on chapter target dates (if set).
- **Status**: On track / At risk / Behind, from coverage vs expected.

| ID | Requirement | Pri |
|---|---|---|
| FR-TPR-01 | **Syllabus builder** (Admin/Super Admin; teacher can edit for own class-subjects if allowed in settings): add book, chapters, topics; reorder; topic size; chapter target date. **Copy syllabus** to other classes with the same subject and to next year. | M |
| FR-TPR-02 | Import syllabus from a simple Excel/CSV (Book, Chapter, Topic, Size). | S |
| FR-TPR-03 | **Weekly plan:** teacher picks a week (Mon–Sat), and for each of their class-subjects selects planned topics from the syllabus (not-yet-completed shown first) and adds a note. **Copy to another class** of the same subject. **Carry forward** unfinished topics from last week. Status Draft / Submitted; due by a set time (default Monday 10:00); late plans marked "Late". | M |
| FR-TPR-04 | Admin/Super Admin can view all weekly plans and add a comment; teacher sees the comment. | M |
| FR-TPR-05 | **Lesson log** (two-tap pattern): date, class-subject, topics with Started/Completed, optional pages/exercise, optional note. Also "No lesson today" with reason (Test, Revision, Teacher absent, Event, Other) so the gap is explained. | M |
| FR-TPR-06 | Teacher can edit a lesson log for 48 hours; after that Admin/Super Admin only (logged). | M |
| FR-TPR-07 | **Homework** (part of lesson log or separate): title, details, due date, optional photo/PDF. Visible to parents of students taking that subject. | M |
| FR-TPR-08 | **Progress calculation** per class-subject: Coverage %, Expected % (if target dates exist), Status, Remaining topics/periods, Completed this week, Plan completion % for the week (planned topics completed ÷ planned topics), simple projected finish date based on the last 4 weeks' speed. Updates as soon as a log is saved. | M |
| FR-TPR-09 | **Teacher view** per class-subject: progress bar, chapter list with ✅ completed / ◐ in progress / ○ remaining, status chip, remaining count, upcoming chapter targets. | M |
| FR-TPR-10 | **Parent view** per subject: "This week" topics taught + homework; overall progress bar (e.g. "Physics — 55% of syllabus covered"); list of completed chapters. (Status On track/Behind hidden from parents by default — setting.) | M |
| FR-TPR-11 | **Admin & Super Admin teaching dashboard:** table of all class-subjects with teacher, coverage %, expected %, status, last log date, plan submitted this week (✅/❌). Filter by class, teacher, status. Tap to see the teacher's logs and plans. | M |
| FR-TPR-12 | **Teacher progress summary** (per teacher, per week/month): average coverage vs expected across their classes; lesson-log days ÷ teaching days; weekly plans on time; tests published within 3 days. Shown as separate numbers (no hidden combined score). The teacher sees the same summary for themselves. | M |
| FR-TPR-13 | Reminder to teacher at 18:00 if a class-subject that had a working day has no lesson log; Monday reminder if weekly plan not submitted. | S |

**Acceptance:**
- Syllabus total size 120 periods; completed topics total 66 → coverage **55%**.
- Expected by today 70%, coverage 55% → difference −15 → status **Behind** (thresholds Appendix B).
- Week plan has 6 topics; 4 logged Completed, 1 Started → plan completion **67%**.
- Logging a topic in 9-A does not change 9-B's progress.

---

### 6.7 Fee Tracking (FEE)

**How it works (simple and clear):**
1. **Super Admin sets fees.** Each class has a **default monthly fee**. The Super Admin can set a **personal monthly fee** for any student (e.g. discount, sibling, scholarship = Rs 0). The student's **effective fee** = personal fee if set, otherwise class default.
2. **Monthly fee rows are created automatically.** On the 1st of every month, each active student gets a fee row for that month with status **Unpaid** and the amount = their effective fee at that moment. A student added mid-month gets a row for the current month too (setting).
3. **Teachers and admins mark Paid.** When a student brings the fee, the teacher (in class) or admin taps **Paid**. The app stores who marked it and when. Tapping again sets it back to Unpaid (logged).
4. **Everyone sees the right view.** Teachers: who has paid / not in their classes and how many remain (no amounts). Admin: same for all classes, plus each student's amount (read-only). Parent: their child's month-by-month status and amount. **Super Admin: all of it plus money totals.**

| ID | Requirement | Pri |
|---|---|---|
| FR-FEE-01 | **Class default monthly fee** — set/edit by Super Admin only. | M |
| FR-FEE-02 | **Personal monthly fee** per student — set/edit/clear by Super Admin only, with optional note (e.g. "Sibling discount"). | M |
| FR-FEE-03 | Fee changes apply from the **next** month's rows. Option (Super Admin) "also update this month if still Unpaid". Paid rows are never changed. | M |
| FR-FEE-04 | **Automatic monthly rows** on the 1st at 00:05 for all active students; safe to re-run (never duplicates). Super Admin/Admin can also trigger "Create this month's fee list" manually. | M |
| FR-FEE-05 | Mid-month admission: create current-month row (setting, default **on**). Removed student: no rows for later months; existing rows stay. | M |
| FR-FEE-06 | **Mark Paid / Unpaid**: Teacher — students of classes where they teach at least one subject; Admin & Super Admin — any student. Stores marked by, marked at; optional note (e.g. "paid to office"). Undo for 5 seconds; later changes allowed but logged. | M |
| FR-FEE-07 | **Waive** a month (status **Waived**, e.g. hardship) — Super Admin only, with reason. Waived months are excluded from expected revenue. | M |
| FR-FEE-08 | **Class fee list** (Teacher/Admin/Super Admin): month picker, counts "Paid 31 · Unpaid 9 · Waived 1 · Total 41", filter Unpaid only, search by name. Admin and Super Admin also see amounts. | M |
| FR-FEE-09 | **All-classes fee overview** (Admin): per class paid/unpaid counts for the month; total unpaid students; list of students unpaid for **2+ months**. | M |
| FR-FEE-10 | **Super Admin Finance screen** for a selected month: total active students; **Expected revenue** (sum of month's fee rows, excluding Waived); **Recovered** (sum of Paid); **Pending** (Expected − Recovered); **Recovery %**; breakdown by class (students, expected, recovered, pending); 12-month trend chart; list of unpaid students with amounts and months unpaid. | M |
| FR-FEE-11 | **Monthly revenue at current fees** (Super Admin): sum of effective fees of all active students — "if everyone pays, this is your monthly revenue". | M |
| FR-FEE-12 | **Parent fee view**: each month with amount and status (✅ Paid on 05 Nov / ⏳ Unpaid / Waived). | M |
| FR-FEE-13 | Optional reminder notification to parents of Unpaid students on a set day (default 10th) — in-app/push only; Super Admin can turn on/off. | S |
| FR-FEE-14 | Exports: class fee list, unpaid list, monthly finance summary (Super Admin) — PDF/Excel. | M |

**Acceptance:**
- Class 9-A default Rs 6,000; student Ali has personal fee Rs 4,500 → Ali's November row = Rs 4,500.
- 40 active students with effective fees totalling Rs 228,000; 31 marked Paid totalling Rs 176,500; 1 Waived (Rs 6,000) → Expected **Rs 222,000**, Recovered **Rs 176,500**, Pending **Rs 45,500**, Recovery **79.5%**.
- Running the monthly job twice creates no duplicate rows.
- A teacher's API response for the fee list contains **no amounts**.
- Super Admin changes Ali's fee to Rs 5,000 on 12 Nov without "also update this month" → November stays Rs 4,500, December row is Rs 5,000.

---

### 6.8 Teacher Salaries (SAL)

| ID | Requirement | Pri |
|---|---|---|
| FR-SAL-01 | **Set monthly salary** per teacher (and per admin staff, optional) — Super Admin only. Effective from a chosen month; history kept. | M |
| FR-SAL-02 | **Salary rows** created monthly (same job as fees) per active teacher with status **Pending**; Super Admin marks **Paid** (date, optional note). | M |
| FR-SAL-03 | **Teacher "My Salary"** screen: current monthly salary and month-by-month status (Paid on date / Pending). A teacher can never see any other person's salary. | M |
| FR-SAL-04 | Admin has **no** salary screens, no salary fields in teacher profiles, and no salary data in any API response or export. | M |
| FR-SAL-05 | Super Admin **Salaries screen**: all teachers with salary, this month's status; totals (salary bill, paid, pending). | M |
| FR-SAL-06 | Super Admin Finance shows **Fees recovered − Salaries paid** for the month as a simple "Net" figure (no other expenses in R1). | S |

**Acceptance:** *Given* an Admin calls any teacher endpoint, *then* the response has no salary fields; *given* teacher A requests teacher B's salary, *then* the server returns "not allowed".

---

### 6.9 Announcements & Notifications (NOT)

| ID | Requirement | Pri |
|---|---|---|
| FR-NOT-01 | **Announcements** with title, text, optional image/PDF, audience: everyone, all parents, all teachers, specific class(es) (parents of that class). Teachers can announce to their own classes. Optional pin to top. | M |
| FR-NOT-02 | **Notification centre** in the app with unread count and tap-to-open. | M |
| FR-NOT-03 | **Push notifications** to installed app on Android and iPhone (iOS 16.4+ after Add to Home Screen). Users can turn categories off (except account security). | M |
| FR-NOT-04 | Notification events — see §9. | M |
| FR-NOT-05 | Parent "daily summary" push at 19:00 (attendance, homework, new results) instead of many separate pushes — setting. | S |

---

### 6.10 Dashboards & Reports (DSH)

| ID | Requirement | Pri |
|---|---|---|
| FR-DSH-01 | **Super Admin Overview** (see §4.2) with tap-through to details. Shows "updated at" time. | M |
| FR-DSH-02 | **Admin Dashboard** (see §4.2) — no revenue or salary figures. | M |
| FR-DSH-03 | **Teacher Today** (see §4.2). | M |
| FR-DSH-04 | **Parent Home** (see §4.2). | M |
| FR-DSH-05 | **Super Admin "people status"**: admins (last active, actions this week), teachers (progress summary FR-TPR-12, attendance marking, fee marking activity), students (active, added, removed), parents (logged in %). | M |
| FR-DSH-06 | Reports (view, PDF, Excel): student list by class; attendance register (class, month); result sheets; teaching progress (all class-subjects); fee status by class/month; unpaid students; finance summary (Super Admin); salaries (Super Admin). | M |

---

### 6.11 Activity Log & Settings (ADM)

| ID | Requirement | Pri |
|---|---|---|
| FR-ADM-01 | **Activity log** of important actions: student added/edited/moved/removed/re-admitted/deleted; class added/removed; teacher assignment changed; attendance edited after the day; marks published/unlocked/corrected; fee marked Paid/Unpaid/Waived; fee amounts changed; salary set/changed/paid; accounts created/deactivated; settings changed. Each entry: who, role, when, what changed (old → new), reason if given. Cannot be edited or deleted. | M |
| FR-ADM-02 | Super Admin sees all entries; Admin sees entries except fee-amount and salary entries. | M |
| FR-ADM-03 | Settings (Super Admin): academy profile & logo, working days, grade scale, pass %, show class average/position to parents, show syllabus status to parents, teacher can edit syllabus, fee row for mid-month admission, fee reminder day, attendance reminder time, plan deadline. | M |
| FR-ADM-04 | Full data export (Excel/CSV) for Super Admin. | S |

---

## 7. Key user journeys

**J1 — New student, same-day parent access.** Admin → Students → **Add** → fills details, class 9-A, parent phone → saves → app creates parent account + setup link → admin taps **Share on WhatsApp** → parent opens link, sets password → sees child's Home. If the parent already has a child here, the new child simply appears in the switcher.

**J2 — A teacher's day.** Opens **Today** → marks 9-A attendance (class teacher) → after each period, **Log lesson** (topics pre-filled from weekly plan; ticks Completed; adds homework) → a student says "fee brought" → **Fees → 9-A → November** → taps Paid. On Monday, submits the **weekly plan** for all classes (copying across sections of the same subject).

**J3 — Test to parent.** Teacher creates "Weekly Test 5 — Ch 4" (25 marks) → enters marks in front of names → Publish → parents notified → parent sees 21/25 (84%, A) and trend.

**J4 — Monthly fees.** 1st: rows created (Unpaid). During the month: teachers/admin mark Paid as fees arrive. Admin checks the "unpaid 2+ months" list and follows up. Super Admin opens **Finance**: expected Rs 2.1M, recovered Rs 1.75M (83%), pending Rs 350k; drills into classes; checks salaries paid vs pending.

**J5 — Student leaves.** Admin → student → **Remove** → reason "Left", date → warning shows 1 unpaid month → confirm → student leaves all active lists; history stays; parent read-only for 30 days.

**J6 — New academic year.** Super Admin/Admin creates new year (copy classes, subjects, teachers, syllabus) → **Promote** wizard per class → Super Admin reviews class fees for the new year.

---

## 8. Screen list by role

### Parent
| ID | Screen |
|---|---|
| P-01 | Setup link (set password) / Login |
| P-02 | Home (child switcher, today, latest result, fee status, this week, announcement) |
| P-03 | Results — list by subject, test detail, subject trend |
| P-04 | Progress — per subject: this week's topics, homework, % covered, chapters done |
| P-05 | Homework list (due today / this week) and detail |
| P-06 | Attendance — month calendar, % |
| P-07 | Fees — month list with amount and status |
| P-08 | Announcements & notifications |
| P-09 | Holidays |
| P-10 | Profile, notifications on/off, install guide, logout |

### Teacher
| ID | Screen |
|---|---|
| T-01 | Setup link / Login |
| T-02 | Today (classes, quick actions, pending items) |
| T-03 | Quick attendance (class teacher) |
| T-04 | Lesson log sheet + homework |
| T-05 | Weekly plan (week picker, per class-subject topic picker, copy, submit) |
| T-06 | My Classes → class detail (students, attendance %, latest results, progress) |
| T-07 | Syllabus progress per class-subject |
| T-08 | Results → tests list (draft / published) |
| T-09 | Create test |
| T-10 | Marks entry |
| T-11 | Test summary (average, highest, lowest, pass count) |
| T-12 | Fees → class → month list (Paid/Unpaid toggles, counts) |
| T-13 | My progress summary |
| T-14 | My salary |
| T-15 | Announcements (create for own classes, view) & notifications |
| T-16 | Profile / role switch |

### Admin
| ID | Screen |
|---|---|
| A-01 | Dashboard |
| A-02 | Students list (search, filters) |
| A-03 | Add / edit student (+ parent linking, subjects) |
| A-04 | Student profile (tabs) — move class, remove, re-admit |
| A-05 | Bulk add students (import) |
| A-06 | Classes list, add/edit class, subjects & teacher assignment, remove class (with move students) |
| A-07 | Subjects list |
| A-08 | Teachers list, add/edit teacher (no salary fields), deactivate, reassign classes |
| A-09 | Parents list (accounts, setup links) |
| A-10 | Attendance today / class register / edit past attendance |
| A-11 | Results — all tests, unlock & correct, result sheets |
| A-12 | Syllabus builder |
| A-13 | Teaching dashboard, weekly plans (view + comment), teacher logs |
| A-14 | Fees — month overview per class (counts), class fee list (mark Paid), unpaid 2+ months |
| A-15 | Announcements |
| A-16 | Holidays & academic year, promotion wizard |
| A-17 | Reports |
| A-18 | Activity log (limited) |

### Super Admin
All Admin screens, plus:
| ID | Screen |
|---|---|
| S-01 | Overview |
| S-02 | Finance (month summary, by class, trend, unpaid with amounts, net) |
| S-03 | Fee settings (class defaults, personal fees, waive) |
| S-04 | Salaries (set salary, monthly paid/pending, totals) |
| S-05 | People status (admins, teachers, students, parents) |
| S-06 | Admin accounts |
| S-07 | Settings |
| S-08 | Full activity log, full export |

---

## 9. Notifications (in-app + push; R1 has no SMS/WhatsApp sending)

| Event | Who | When |
|---|---|---|
| Child marked Absent (Late optional) | Parent(s) | Right after attendance saved |
| Result published / corrected | Parent(s) of students in that test | On publish |
| Homework posted | Parent(s) of students taking the subject | On save (or in 19:00 summary) |
| Announcement | Audience | On post |
| Fee unpaid reminder (if enabled) | Parent(s) of unpaid students | Set day, 10:00 |
| Fee marked Paid | Parent(s) | On marking (setting, default on) |
| Weekly plan not submitted | Teacher | Monday at deadline |
| Lesson log missing | Teacher | 18:00 |
| Attendance not marked | Class teacher; Admin at 12:00 | Reminder time |
| Test not published after 3 days | Teacher | 10:00 |
| Comment on weekly plan | Teacher | On comment |
| Correction requested by teacher | Admin | On request |
| Salary marked Paid | Teacher | On marking |

---

## 10. Non-functional requirements (summary — details in `SRS.md` §7)

| Area | Requirement |
|---|---|
| Speed | First load ≤ 3 s and later screens ≤ 1 s on a mid-range Android over 4G; server responses ≤ 500 ms for 95% of requests. |
| Reliability | 99.5% uptime monthly; automatic daily backups kept 30 days, plus point-in-time restore for the last 7 days. |
| Data safety | Drafts saved on the device; server refuses duplicate submissions; no financial or academic record is ever hard-deleted (except Super Admin delete of mistaken students with no history). |
| Security | HTTPS only; hashed passwords; server-side permission checks on every request; salary and revenue data restricted at the API level; activity log. |
| Privacy | Minimum personal data; student photos and documents private; parents see only their children. |
| Devices | Android 9+ (Chrome, Samsung Internet), iPhone iOS 16.4+ (Safari), desktop Chrome/Edge/Firefox/Safari. |
| Accessibility | WCAG 2.2 AA basics. |
| Capacity | 3,000 students / 150 teachers comfortably; 3× headroom. |

---

## 11. Release plan and later roadmap

### 11.1 Release 1 plan (indicative ~14–16 weeks; team: 2 full-stack devs, 1 designer (part-time), 1 QA, 1 PM/owner)
| Phase | Weeks | Scope | Done when |
|---|---|---|---|
| 1. Design | 1–2 | Clickable prototype of Home screens, quick attendance, marks entry, lesson log, fee marking; test with 3 teachers + 3 parents | Users complete tasks without help |
| 2. Foundation | 3–5 | Accounts & roles, academy setup, students, activity log, PWA shell | Real academy data set up |
| 3. Daily teaching | 6–8 | Attendance, syllabus, weekly plan, lesson log, homework, progress calculation | Progress numbers match a hand-calculated sheet |
| 4. Results | 9–10 | Tests, marks entry, publish, corrections, result sheets | One month of real tests entered correctly |
| 5. Fees & salaries | 11–12 | Fee settings, monthly rows, marking, finance screen, salaries | Finance totals match manual register for one month |
| 6. Dashboards & launch | 13–16 | Dashboards, reports, notifications, testing on low-end phones, security check, pilot | Pilot with 2 classes for 2 weeks, then full rollout |

### 11.2 Later (only after the core is stable)
- **R1.1:** Urdu interface, printable report cards, parent leave requests, better import, PIN/fingerprint unlock.
- **R2:** online fee payment (JazzCash/Easypaisa/Raast), receipts, SMS/WhatsApp alerts and OTP reset, parent–teacher chat, timetable, multiple branches, student logins, basic expenses & payroll slips.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Teachers skip lesson logs | Two-tap logging pre-filled from the plan; teacher sees own progress; reminders. |
| Parents don't log in | Setup link shared at admission desk; value on day one (attendance, fee status). |
| Fee marked Paid by mistake | 5-second undo; every change logged with name; Super Admin month-end check against cash register. |
| Teacher marks fee for wrong class | Teachers can only see/mark students in classes they teach. |
| Salary data leaks | Salary data never leaves the server except to Super Admin and the teacher themself; automated tests on every API. |
| Weak network | Light pages, local drafts, offline queue. |
| Scope creep | Anything not in §6 goes to §11.2 unless the owner removes something of equal size. |

---

## 13. Open questions (defaults apply if not answered)

| # | Question | Default |
|---|---|---|
| Q1 | Should teachers mark fees for all their classes, or only the class teacher? | All teachers of that class (any one can mark). |
| Q2 | Should a parent see amount, or status only? | Amount + status. |
| Q3 | Do parents get a push when fee is marked Paid? | Yes. |
| Q4 | Show class average / position to parents? | Average yes, position no. |
| Q5 | Daily attendance or per subject? | Daily per class. |
| Q6 | Can teachers edit the syllabus? | No — admin builds it; teachers suggest. |
| Q7 | Fee row for students who join mid-month? | Yes, full month. |
| Q8 | Do admin staff also get salary records? | Optional; same screen as teachers. |

---

## Appendix A — Glossary
| Term | Meaning |
|---|---|
| Class | Teaching group (e.g. "9-A Morning"). |
| Class-subject | A subject taught in a class by one teacher. |
| Class teacher | Teacher in charge of a class (marks daily attendance). |
| Effective fee | Student's personal monthly fee if set, otherwise the class default. |
| Fee row | One student's fee for one month: amount + Paid/Unpaid/Waived. |
| Expected revenue | Sum of a month's fee rows, excluding Waived. |
| Recovered | Sum of Paid rows. |
| Pending | Expected − Recovered. |
| Coverage % | Completed topic size ÷ total topic size. |
| Expected % | Planned coverage by today from chapter target dates. |
| Weekly plan | Topics a teacher plans for the week. |
| Lesson log | What was actually taught on a day. |

## Appendix B — Defaults
| Setting | Default |
|---|---|
| Working days | Mon–Sat |
| Monthly fee rows created | 1st of month, 00:05 |
| Fee reminder (if on) | 10th, 10:00 |
| Weekly plan deadline | Monday 10:00 |
| Lesson-log reminder | 18:00 |
| Attendance reminder | 11:00 |
| Teacher edit window — attendance / lesson log | Same day / 48 hours |
| Pass mark | 40% |
| Grades | A+ ≥ 90 · A ≥ 80 · B ≥ 70 · C ≥ 60 · D ≥ 50 · E ≥ 40 · F < 40 |
| Progress status | On track: coverage ≥ expected − 5 · At risk: expected − 5 to − 15 · Behind: below expected − 15 (percentage points) |
| Parent read-only after removal | 30 days |
| Session length | Parent/Teacher 60 d · Admin 14 d · Super Admin 7 d |

## Appendix C — References
- StatCounter — Mobile OS share, Pakistan: https://gs.statcounter.com/os-market-share/mobile-tablet/pakistan
- StatCounter — Mobile browser share, Pakistan: https://gs.statcounter.com/browser-market-share/mobile-tablet-/pakistan
- Economic Survey 2025–26 figures (Pakistan Observer): https://pakobserver.net/pakistan-sees-71-6-rise-in-smartphone-users-check-number-of-broadband-users/
- iOS web push requirements (Pushpad): https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications
- WhatsApp Business pricing (Meta): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Pakistan data-protection status 2026: https://www.recordinglaw.com/world-laws/world-data-privacy-laws/pakistan-data-privacy-laws/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
