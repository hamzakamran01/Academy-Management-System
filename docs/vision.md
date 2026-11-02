# Campusly — Product Vision

> **Campusly** — the academy, on every phone.
> Version 1.1 · 2 Nov 2026 · Companion documents: `PRD.md` (what we build), `SRS.md` (how the system must behave)

---

## 1. Vision statement

**One simple, reliable app on every teacher's and parent's phone that shows — truthfully and instantly — how each student is doing, what each teacher has taught, and where the academy stands on students, fees and salaries.**

## 2. The problem

Academies today run on paper registers, Excel sheets and WhatsApp groups:

| Who | Today | Result |
|---|---|---|
| **Parents** | Learn about results late; don't know what was taught this week or whether the fee is marked as paid. | Surprises, low trust. |
| **Teachers** | Write marks on paper; syllabus progress lives in their head; fee collection noted in a notebook. | Double work, invisible effort. |
| **Admin** | Keeps student lists, classes and fee status in separate sheets. | Errors, hours lost every week. |
| **Owner (Super Admin)** | Has no single view of student count, expected vs recovered fees, salaries, or which teacher is behind on the syllabus. | Decisions by guesswork. |

The gap is **one connected record** that each role updates as part of their normal day, and that every role sees in the form useful to them.

## 3. The four roles

| Role | Who | What they get |
|---|---|---|
| **Super Admin** | Owner / director | Sees and manages everything: all students, classes, teachers, admins, results, teaching progress, attendance. **Only role that sets student fees and teacher salaries** and sees academy revenue. |
| **Admin** | Office / operations manager | Runs day-to-day operations: add/remove students, add/remove classes, assign teachers, create parent and teacher accounts, **mark fee status**, post announcements, monitor attendance and results. **Cannot set fees, cannot see or set salaries.** |
| **Teacher** | Subject teacher | For their own classes and subjects only: mark attendance, add results in front of student names, upload the weekly plan, log exactly what was taught (book → chapter → topic), give homework, **mark fee as Paid/Unpaid** when students report it in class, see who has paid and who hasn't. Sees **only their own salary**. |
| **Parent** | Father / mother / guardian | For their own child(ren): attendance, results, what was taught this week and what's remaining, homework, monthly fee status, announcements. |

## 4. What makes it valuable

1. **Teaching progress you can see.** Every class-subject has a syllabus (book → chapter → topic). Teachers plan the week and log what they actually taught. The app calculates **% covered, what's remaining, and whether the class is on track** — for the teacher, the admin, the owner and the parent.
2. **Results in front of names, on a phone.** A teacher opens a test, sees the list of his students, types marks, publishes. Parents see them immediately.
3. **Fee tracking without paperwork.** Each student has a monthly fee row. The teacher or admin taps **Paid** when the fee comes in. Everyone sees counts and lists of paid and unpaid students; only the owner sees the money totals.
4. **Clear money picture for the owner.** Total students × each student's fee = expected revenue; recovered vs pending; teacher salaries — in one screen.
5. **Mobile-first and fast.** Designed for one thumb on an inexpensive Android phone and a weak connection. Daily tasks take under a minute.

## 5. Product principles

1. **Core first, done perfectly.** Every module the owner asked for works flawlessly before anything advanced is added.
2. **Simple beats clever.** Paid / Unpaid. Present / Absent. Covered / Remaining. No hidden formulas.
3. **Phone first.** Every screen is designed at 360 px width first; desktop is a bonus for the office.
4. **Enter once, see everywhere.** Marks entered by a teacher appear for the parent, admin and owner without re-typing.
5. **Right people see the right things.** Salaries are private; fee amounts are set only by the owner; teachers see only their classes; parents see only their children.
6. **Never lose work.** Drafts are saved automatically, even if the network drops.
7. **Every important change is traceable.** Who marked a fee, changed a mark or removed a student — and when.

## 6. Scope of Release 1 (the "core")

1. Accounts & roles (4 roles, phone-number login)
2. Academy setup — academic year, classes, subjects, teacher assignments, holidays
3. Students — add, edit, move class, remove, re-admit, link parents
4. Attendance — daily, by class
5. Results — tests & exams, marks entry in front of names, publish to parents
6. Teaching progress — syllabus, weekly plan, daily lesson log, homework, coverage & remaining
7. Fee tracking — monthly Paid/Unpaid per student; owner-set fees; owner revenue view
8. Teacher salaries — owner sets; teacher sees own only
9. Announcements & notifications (in-app + phone push)
10. Dashboards & simple reports for each role
11. Activity log & basic settings

## 7. Deliberately *not* in Release 1

Online fee payments or payment gateways · invoices/receipts/fines · SMS/WhatsApp automation · chat between parents and teachers · timetable builder · multiple branches · student logins · payroll processing · expenses/accounting · native app-store apps (R1 is an installable web app). These can come later once the core is solid (see PRD §11).

## 8. Success metrics (first 3 months after launch)

| Goal | Metric | Target |
|---|---|---|
| Parents use it | Parents who have logged in at least once / enrolled students | ≥ 80% |
| Parents return | Parents active weekly | ≥ 50% |
| Teachers log teaching | Teaching days with a lesson log | ≥ 90% |
| Attendance is digital | Class-days with attendance marked same day | ≥ 95% |
| Results are fast | Tests published within 3 days of test date | ≥ 90% |
| Fees are tracked | Monthly fee rows marked (paid) by month-end vs actual collections | 100% match on monthly check |
| Quality | App loads in ≤ 3 s on a mid-range Android on 4G; no data-loss incidents | Met |

## 9. Context that shaped these choices

- Android is roughly 91–92% of mobile phones in Pakistan and Chrome is the main browser, so an installable web app (PWA) reaches almost everyone without app-store hassle.
- About 28% of mobile users were still on 2G in 2025–26, so screens must be light and drafts must survive bad connections.
- On iPhone, notifications from a web app work only after it is added to the Home Screen (iOS 16.4+), so onboarding shows how to install it.
- WhatsApp Business messages are charged per message, so R1 uses free in-app and push notifications; sharing a login link uses the admin's own WhatsApp (share link), not a paid API.

## 10. Roadmap at a glance

| Release | Theme | Contents |
|---|---|---|
| **R1 — Core** | Everything the owner asked for, rock-solid | Modules 1–11 above |
| **R1.1 — Polish** | Small, high-value additions | Urdu interface, printable report cards, leave requests, CSV import improvements |
| **R2 — Growth** | When the core is proven | Online fee payment, SMS/WhatsApp alerts, parent–teacher chat, timetable, multiple branches, student logins |

## 11. What success looks like

On a Sunday evening a parent opens Campusly: her son was present all week, his Physics teacher completed Chapter 4 and gave two homework tasks, his last test was 34/40, and November's fee shows **Paid**. The teacher never used paper. The admin never typed a mark. The owner saw students, fees, salaries and teaching progress on one screen.
