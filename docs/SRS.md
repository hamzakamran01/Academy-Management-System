# Campusly — Software Requirements Specification (SRS)

> Version 1.1 (Core release) · 2 Nov 2026 · Owner: Engineering
> Implements `PRD.md` v1.1. Where this document and the PRD differ on *what* the product does, the PRD wins; where they differ on *how* the system behaves, this document wins.

---

## Contents

1. Introduction
2. Overall description
3. Architecture
4. Data model
5. Authorization model
6. Functional behaviour and business rules
   - 6.1 Accounts & Roles · 6.2 Academy Setup · 6.3 Students · 6.4 Attendance · 6.5 Results · 6.6 Teaching Progress · 6.7 Fee Tracking · 6.8 Salaries · 6.9 Notifications · 6.10 Dashboards & Reports · 6.11 Activity Log
7. Non-functional requirements
8. External interfaces (UI, API, push, storage)
9. Scheduled jobs
10. Security and privacy
11. Testing and acceptance
12. Environments, deployment, backup and monitoring
13. Traceability (PRD → SRS)

---

## 1. Introduction

### 1.1 Purpose
Specify the behaviour, data, interfaces and quality attributes of Campusly Release 1 so that it can be built, tested and accepted.

### 1.2 Scope
A mobile-first, installable web application (PWA) with a server API and database, for one academy with four roles (Super Admin, Admin, Teacher, Parent), covering: accounts, academy setup, students, attendance, results, teaching progress (syllabus, weekly plan, lesson log, homework), fee status tracking, teacher salaries, announcements/notifications, dashboards/reports and an activity log.

**Out of scope (R1):** payment processing of any kind, invoices/receipts/fines, SMS/WhatsApp sending APIs, chat, timetable, multiple branches, student logins, payroll processing, accounting.

### 1.3 Definitions
See PRD Appendix A. Additional: **PWA** — Progressive Web App; **API** — the server's HTTP interface; **DTO** — the shape of data the API returns; **PKT** — Pakistan Standard Time (UTC+5, no daylight saving); **Working day** — a day that is in the academy's working days and is not a holiday.

### 1.4 References
`docs/vision.md`, `PRD.md`, WCAG 2.2, OWASP ASVS 4.x, OWASP Top 10, Web Push Protocol (RFC 8030) with VAPID (RFC 8292).

---

## 2. Overall description

### 2.1 Product perspective
A single new system replacing paper registers and spreadsheets. No integrations are required in R1. The API is designed so a native app or payment integration can be added later without changes to existing endpoints.

### 2.2 User classes
| Class | Typical device | Frequency | Key needs |
|---|---|---|---|
| Parent | Android phone (low/mid-range), some iPhones | Several times a week, 2–4 min | Read-only, fast, clear |
| Teacher | Android phone | Several times a day, < 1 min per task | Fast entry, works on weak network |
| Admin | Desktop + phone | Daily, long sessions | Lists, search, bulk work |
| Super Admin | Phone + desktop | Daily check-ins | Totals, drill-down, control |

### 2.3 Operating environment
- **Clients:** Android 9+ with Chrome or Samsung Internet (current and previous 2 major versions); iOS/iPadOS 16.4+ Safari; desktop Chrome, Edge, Firefox, Safari (current − 1). Minimum viewport 320 px.
- **Server:** Linux containers; PostgreSQL 16+; HTTPS only.

### 2.4 Design constraints
- C1: Must be a PWA (installable, service worker, web app manifest).
- C2: No paid messaging APIs in R1; notifications are in-app and Web Push only.
- C3: All times stored in UTC, displayed and scheduled in Asia/Karachi.
- C4: Money stored as **integer rupees** (PKR; no paisa in R1).
- C5: UI strings externalised for translation (Urdu in R1.1).
- C6: Single academy in R1, but every business table has `academy_id` for future multi-branch/multi-tenant use.

### 2.5 Assumptions and dependencies
- A managed PostgreSQL service with automated backups and point-in-time recovery.
- An S3-compatible object store for photos and attachments.
- A domain with TLS certificate.

---

## 3. Architecture

### 3.1 Style
A **modular monolith**: one deployable web application containing the UI and the API, one PostgreSQL database, one object store, and a background job runner using the same database. This is the simplest architecture that is still robust, transactional and easy to operate for a small team.

```
 ┌───────────────────────────── Phones & browsers ─────────────────────────────┐
 │  PWA (React UI)  ·  Service worker (cache, offline queue)  ·  IndexedDB     │
 └───────────────▲───────────────────────────────────────────────▲─────────────┘
                 │ HTTPS (JSON REST /api/v1, cookies)            │ Web Push
 ┌───────────────┴───────────────────────────────────────────────┴─────────────┐
 │                         Campusly App (Node.js, TypeScript)                    │
 │  UI routes  │  API routes  │  Modules: auth · org · students · attendance ·   │
 │             │              │  results · progress · fees · salaries · notify · │
 │             │              │  reports · audit                                 │
 │  Policy layer (permissions + scoping)  │  Validation (shared schemas)          │
 │  Job runner (scheduled + queued jobs, Postgres-backed)                        │
 └───────────────┬───────────────────────────────────────┬─────────────────────┘
                 │ SQL                                    │ Signed URLs
         ┌───────▼────────┐                        ┌──────▼───────┐
         │  PostgreSQL    │                        │ Object store │
         │  (data, jobs,  │                        │ (photos, PDFs)│
         │   sessions)    │                        └──────────────┘
         └────────────────┘
```

### 3.2 Recommended technology (can be substituted with equivalents)
| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript end-to-end | One language, shared validation types |
| Web framework | Next.js (App Router) on Node.js LTS | UI + API in one app; server rendering for fast first load |
| UI | React, Tailwind CSS, accessible headless components (e.g. Radix / shadcn/ui) | Fast to build, consistent, accessible |
| Client data | TanStack Query | Caching, retries, background refresh |
| Forms & validation | React Hook Form + Zod (schemas shared with server) | Same rules on phone and server |
| Offline | Service worker (Workbox/Serwist) + IndexedDB (Dexie) for drafts & queue | Never lose entries |
| Database | PostgreSQL 16+ | Reliable, transactional, strong constraints |
| ORM / migrations | Prisma (or Drizzle) | Typed queries, versioned migrations |
| Jobs | pg-boss (Postgres-backed queue & cron) | No extra infrastructure (no Redis needed) |
| Push | Web Push with VAPID (`web-push` library) | Free, works on Android and installed iOS PWAs |
| Files | S3-compatible storage (e.g. Cloudflare R2, AWS S3) | Cheap, private, signed URLs |
| PDF/Excel exports | Server-side generation (e.g. PDFKit/React-PDF; ExcelJS) | Printable reports |
| Monitoring | Sentry (errors), uptime monitor, structured JSON logs | Find problems before users report them |

### 3.3 Module boundaries
Each module owns its tables and exposes service functions; other modules call services, not tables directly. Cross-module rules (e.g. "removing a student stops fee rows") are implemented in the owning module's service and triggered by domain events within the same database transaction.

| Module | Owns |
|---|---|
| auth | users, role_assignments, sessions, setup_tokens, push_subscriptions |
| org | academy, academic_years, holidays, classes, subjects, class_subjects, class_subject_teachers |
| students | students, parent_links, enrollments, student_subject_exclusions |
| attendance | attendance_days, attendance_marks |
| results | assessments, marks, grade_scale |
| progress | books, chapters, topics, weekly_plans, weekly_plan_topics, lesson_logs, lesson_log_topics, homework, topic_progress, plan_comments |
| fees | class_fees, student_fees, fee_rows |
| salaries | salary_settings, salary_rows |
| notify | announcements, notifications |
| audit | activity_log |

---

## 4. Data model

Conventions: every table has `id` (UUID v7), `academy_id`, `created_at`, `updated_at`; soft-archive via `archived_at` where noted; `version` (integer) on records edited concurrently. All foreign keys are enforced. Text fields are UTF-8 (Urdu supported).

### 4.1 Entities and key fields

**users** — `phone` (E.164, unique), `name`, `photo_key?`, `password_hash`, `status` (active | deactivated), `failed_logins`, `locked_until?`, `last_login_at?`.

**role_assignments** — `user_id`, `role` (super_admin | admin | teacher | parent), `active` (bool). Unique (`user_id`, `role`).

**sessions** — `user_id`, `role`, `token_hash`, `expires_at`, `last_seen_at`, `device_label`, `revoked_at?`.

**setup_tokens** — `user_id`, `token_hash`, `expires_at`, `used_at?`, `created_by`.

**academy** — `name`, `logo_key?`, `address`, `phone`, `settings` (JSON, validated schema; see §6.11.2).

**academic_years** — `name` (e.g. "2026–27"), `start_date`, `end_date`, `is_current` (exactly one true — partial unique index), `working_days` (int array 1–7).

**holidays** — `academic_year_id`, `name`, `start_date`, `end_date`.

**classes** — `academic_year_id`, `name`, `level` (int, for ordering), `shift?`, `capacity?`, `class_teacher_id?` (users), `archived_at?`. Unique (`academic_year_id`, `name`) among non-archived.

**subjects** — `name`, `code?`, `archived_at?`. Unique `name`.

**class_subjects** — `class_id`, `subject_id`, `archived_at?`. Unique (`class_id`, `subject_id`).

**class_subject_teachers** — `class_subject_id`, `teacher_id`, `from_date`, `to_date?`. At most one open row (`to_date` null) per class_subject.

**students** — `registration_no` (unique, e.g. `CL-26-0042`), `name`, `guardian_name`, `gender`, `dob?`, `photo_key?`, `address?`, `notes?`, `status` (active | removed), `removed_reason?`, `removed_note?`, `removed_on?`.

**parent_links** — `parent_user_id`, `student_id`, `relation` (father | mother | guardian). Unique pair; max 2 per student (application rule).

**enrollments** — `student_id`, `class_id`, `roll_no`, `from_date`, `to_date?`. At most one open enrollment per student. Unique (`class_id`, `roll_no`) among open enrollments.

**student_subject_exclusions** — `enrollment_id`, `class_subject_id` (subjects the student does **not** take).

**attendance_days** — `class_id`, `date`, `marked_by`, `marked_at`, `version`. Unique (`class_id`, `date`).

**attendance_marks** — `attendance_day_id`, `student_id`, `status` (present | absent | late | leave). Unique (`attendance_day_id`, `student_id`).

**grade_scale** — `min_percent`, `grade`, `remark?` (ordered rows; stored in academy settings in R1).

**assessments** — `class_subject_id`, `type` (weekly | monthly | midterm | final | other), `title`, `date`, `total_marks` (numeric(5,1) > 0), `chapter_ids` (UUID[]), `status` (draft | published | unlocked), `published_at?`, `published_by?`, `unlock_reason?`, `corrected_at?`, `created_by`, `version`, `exam_group_id?`.

**marks** — `assessment_id`, `student_id`, `value` (numeric(5,1) null), `is_absent` (bool), `updated_by`. Unique (`assessment_id`, `student_id`). Check: `is_absent` xor `value is not null` for complete entries; `0 ≤ value ≤ total_marks` (enforced in service; total is on parent row).

**books** — `class_subject_id`, `title`, `order`.
**chapters** — `book_id`, `title`, `order`, `target_date?`.
**topics** — `chapter_id`, `title`, `order`, `size` (int 1–20, default 1), `archived_at?`.

**weekly_plans** — `class_subject_id`, `teacher_id`, `week_start` (Monday date), `note?`, `status` (draft | submitted), `submitted_at?`, `is_late` (bool). Unique (`class_subject_id`, `week_start`).
**weekly_plan_topics** — `weekly_plan_id`, `topic_id`.
**plan_comments** — `weekly_plan_id`, `author_id`, `text`.

**lesson_logs** — `class_subject_id`, `teacher_id`, `date`, `no_lesson_reason?` (test | revision | teacher_absent | event | other), `note?`, `client_id` (UUID from device, unique — dedupe), `version`. Unique (`class_subject_id`, `date`).
**lesson_log_topics** — `lesson_log_id`, `topic_id`, `status` (started | completed), `pages?`.

**topic_progress** (derived, maintained by service) — `class_subject_id`, `topic_id`, `status` (not_started | started | completed), `completed_on?`. Unique pair.

**homework** — `class_subject_id`, `lesson_log_id?`, `title`, `details?`, `due_date`, `attachment_keys` (text[]), `created_by`.

**class_fees** — `class_id`, `monthly_fee` (int ≥ 0), `set_by`, `set_at`. One row per class (history in activity log).

**student_fees** — `student_id`, `monthly_fee` (int ≥ 0), `note?`, `set_by`, `set_at`. Optional; absence = use class fee.

**fee_rows** — `student_id`, `class_id` (class at creation), `month` (date, first day of month), `amount` (int ≥ 0, snapshot), `status` (unpaid | paid | waived), `marked_by?`, `marked_at?`, `note?`, `waive_reason?`, `version`. **Unique (`student_id`, `month`).**

**salary_settings** — `user_id` (teacher/admin staff), `monthly_salary` (int ≥ 0), `effective_from` (first day of month), `set_by`. Effective salary for month M = latest row with `effective_from ≤ M`.

**salary_rows** — `user_id`, `month`, `amount` (snapshot), `status` (pending | paid), `paid_on?`, `note?`, `marked_by?`. **Unique (`user_id`, `month`).**

**announcements** — `title`, `body`, `attachment_keys`, `audience_type` (all | parents | teachers | classes), `class_ids` (UUID[]), `pinned`, `author_id`, `published_at`.

**notifications** — `user_id`, `role`, `type`, `title`, `body`, `link`, `read_at?`, `push_sent_at?`.

**push_subscriptions** — `user_id`, `endpoint` (unique), `p256dh`, `auth`, `user_agent`, `last_success_at?`, `failed_count`.

**activity_log** — `actor_id`, `actor_role`, `action` (e.g. `fee_row.mark_paid`), `entity_type`, `entity_id`, `before` (JSON), `after` (JSON), `reason?`, `ip`, `user_agent`, `sensitivity` (normal | finance_amount | salary), `at`. Append-only: application DB role has INSERT/SELECT only on this table.

### 4.2 Relationships (summary)
```
academic_year 1─* class 1─* class_subject *─1 subject
class_subject 1─* class_subject_teachers *─1 user(teacher)
class 1─* enrollment *─1 student 1─* parent_links *─1 user(parent)
enrollment 1─* student_subject_exclusions *─1 class_subject
class 1─* attendance_day 1─* attendance_marks *─1 student
class_subject 1─* assessment 1─* marks *─1 student
class_subject 1─* book 1─* chapter 1─* topic
class_subject 1─* weekly_plan 1─* weekly_plan_topics *─1 topic
class_subject 1─* lesson_log 1─* lesson_log_topics *─1 topic
class_subject 1─* topic_progress
class 1─1 class_fees ;  student 0..1─1 student_fees ;  student 1─* fee_rows
user 1─* salary_settings ;  user 1─* salary_rows
```

### 4.3 Key indexes
`enrollments(class_id) where to_date is null` · `attendance_days(class_id, date)` · `marks(assessment_id)` · `fee_rows(month, status)` · `fee_rows(class_id, month)` · `lesson_logs(class_subject_id, date)` · `topic_progress(class_subject_id)` · `notifications(user_id, read_at)` · `activity_log(entity_type, entity_id)`, `activity_log(at)` · trigram index on `students.name` for search.

### 4.4 Data retention
Nothing academic or financial is hard-deleted. Archived/removed records remain queryable for history and reports. Exceptions: Super Admin permanent delete of a mistaken student with no attendance/marks/fee-marked history (cascade-deletes their unmarked fee rows and links); expired sessions and used setup tokens purged after 30 days; notifications older than 12 months purged.

---

## 5. Authorization model

### 5.1 Principle
Every API request passes through: **authenticate → load role context → policy check (action + resource) → scoped query → role-specific DTO**. UI hiding is cosmetic only.

### 5.2 Teacher scope
For a teacher in the current academic year:
- `teacher_class_subjects` = class_subjects with an open `class_subject_teachers` row for the teacher.
- `teacher_classes` = classes of those class_subjects ∪ the class where they are `class_teacher_id`.
- **Students visible** = students with an open enrollment in `teacher_classes`.
- **Students in a subject** (for marks, homework audience, lesson context) = students enrolled in the class *minus* those with an exclusion for that class_subject.

### 5.3 Parent scope
`parent_students` = students linked via `parent_links` where the student is active, **or** removed within the last 30 days (read-only). If the set is empty, login shows "No active students linked" and no data.

### 5.4 Field-level restrictions (DTO rules)
| Data | Super Admin | Admin | Teacher | Parent |
|---|---|---|---|---|
| `fee_rows.amount`, class/student fee amounts | ✔︎ | ✔︎ read | ✘ (field omitted) | ✔︎ own children |
| Revenue aggregates (expected / recovered / pending Rs) | ✔︎ | ✘ (endpoint 403) | ✘ | ✘ |
| `salary_*` | ✔︎ all | ✘ (endpoint 403; no salary fields on any user DTO) | ✔︎ own only via `/me/salary` | ✘ |
| Activity log entries with `sensitivity` ≠ normal | ✔︎ | ✘ (filtered out) | ✘ | ✘ |
| Student `notes`, `address`, `dob` | ✔︎ | ✔︎ | ✘ | ✔︎ own children |
| Parent phone | ✔︎ | ✔︎ | ✔︎ (for contact) | own |

### 5.5 Action rules (normative)
| Action | Allowed roles / condition |
|---|---|
| Create/deactivate admin accounts | super_admin |
| Create/deactivate teacher & parent accounts | super_admin, admin |
| Manage classes, subjects, assignments, holidays, academic years | super_admin, admin |
| Add/edit/move/remove/re-admit student | super_admin, admin |
| Permanently delete student | super_admin, and student has no attendance marks, no marks, no fee rows with status ≠ unpaid |
| Mark attendance for class C on date D | super_admin, admin; teacher if `class_teacher_id = teacher` of C and D = today (PKT) |
| Edit attendance for past date | super_admin, admin (reason required) |
| Create assessment / enter marks / publish | super_admin, admin; teacher if class_subject ∈ teacher_class_subjects and assessment status ∈ {draft, unlocked} |
| Unlock published assessment | super_admin, admin (reason required) |
| Edit syllabus | super_admin, admin; teacher for own class_subjects only if setting `teacher_can_edit_syllabus` |
| Create/edit weekly plan, lesson log, homework | teacher for own class_subjects (lesson log edit ≤ 48 h after `date` end); super_admin/admin any time (logged) |
| Comment on weekly plan | super_admin, admin |
| Set class fee / student fee / waive fee row | super_admin |
| Mark fee row paid/unpaid | super_admin, admin; teacher if student ∈ teacher-visible students (§5.2) and fee row's month ≤ current month |
| View fee rows | super_admin, admin (with amounts); teacher (visible students, no amounts); parent (own children, with amounts) |
| Set salary / mark salary paid | super_admin |
| View salary | super_admin (all); teacher/admin-staff (own only) |
| Post announcement | super_admin, admin (any audience); teacher (audience = own classes only) |

---

## 6. Functional behaviour and business rules

Business rules are numbered `BR-<module>-nn` and are testable.

### 6.1 Accounts & Roles (FR-AUTH-*)
- **BR-AUTH-01** Phone normalisation: accept `03xx-xxxxxxx`, `3xxxxxxxxx`, `+923xxxxxxxxx`, `00923…`; store `+923xxxxxxxxx`; reject others with "Enter a valid Pakistani mobile number".
- **BR-AUTH-02** Creating an account for an existing phone adds the role to the existing user instead of creating a new user.
- **BR-AUTH-03** Setup token: 32 random bytes, URL-safe; only the SHA-256 hash is stored; valid 7 days; single use; generating a new one invalidates earlier unused tokens for that user.
- **BR-AUTH-04** "Share on WhatsApp" opens `https://wa.me/<phone digits without +, e.g. 923001234567>?text=<URL-encoded message with link>` on the creator's device; the server never sends the message.
- **BR-AUTH-05** Password: min 8 chars, not in a list of common passwords; hashed with Argon2id (memory ≥ 19 MiB, iterations ≥ 2).
- **BR-AUTH-06** After 5 consecutive failures, `locked_until = now + 15 min`; login responses never reveal whether the phone exists ("Incorrect phone or password").
- **BR-AUTH-07** Session: random 256-bit token in an HttpOnly, Secure, SameSite=Lax cookie; stored hashed; sliding expiry per role (Parent/Teacher 60 d, Admin 14 d, Super Admin 7 d); `last_seen_at` updated at most every 5 min.
- **BR-AUTH-08** Deactivation or role removal revokes all sessions for that role immediately; the client receives 401 on the next request and returns to login.
- **BR-AUTH-09** Role context is part of the session. Switching role creates a new session context without re-entering the password if the user holds that role.

### 6.2 Academy Setup (FR-ORG-*)
- **BR-ORG-01** Exactly one academic year is current. Making a year current is a Super Admin/Admin action and does not change data of the old year (old year becomes read-only for teachers; admins can still view and export).
- **BR-ORG-02** "Copy from previous year" copies classes (names, levels, shifts, class teachers), class_subjects, open teacher assignments, class fees, and the full syllabus tree (books, chapters with target dates shifted by whole years, topics). It does **not** copy enrollments (use promotion), attendance, marks, plans, logs, or fee rows.
- **BR-ORG-03** Removing (archiving) a class is rejected with error `CLASS_HAS_STUDENTS` and the count, if any open enrollment exists.
- **BR-ORG-04** Changing a class-subject's teacher closes the open assignment (`to_date = yesterday`) and opens a new one from today; plans and logs keep their original `teacher_id`.
- **BR-ORG-05** Working day check `is_working_day(date)` = weekday ∈ year.working_days AND date not within any holiday AND date within year start/end.

### 6.3 Students (FR-STU-*)
- **BR-STU-01** Registration number format `<PREFIX>-<YY>-<NNNN>` where YY = admission year, NNNN = per-year sequence (DB sequence, gap-tolerant). Prefix set in settings (default `CL`).
- **BR-STU-02** Roll number suggestion = max numeric roll in class + 1; must be unique among the class's open enrollments.
- **BR-STU-03** Add student runs in one transaction: create student → enrollment → exclusions → parent user(s)/links (reuse by phone per BR-AUTH-02) → setup token(s) for new parents → current-month fee row if setting `fee_row_on_join` is on (amount per BR-FEE-02) → activity log.
- **BR-STU-04** Move class on date D: close current enrollment (`to_date = D − 1`), open new enrollment from D with new roll number; exclusions are re-evaluated (subject not offered in new class is dropped). Existing fee rows keep their `class_id`; future rows use the new class.
- **BR-STU-05** Remove on date D: close enrollment (`to_date = D`), set status removed with reason/note/date. Effects: excluded from attendance lists after D, from marks entry for assessments dated after D, and from fee-row generation for months starting after D. Fee rows already created are unchanged. The API returns `unpaid_months` so the UI can show the warning.
- **BR-STU-06** Re-admit: status → active, new enrollment from chosen date; same registration number; creates current-month fee row per setting if none exists.
- **BR-STU-07** Promotion (year end): for each selected student, create enrollment in the target class of the new current year from the new year's start date; "keep back" enrolls in the equivalent class of the new year; "remove" applies BR-STU-05 with reason "Completed" or chosen reason.
- **BR-STU-08** Bulk import: XLSX/CSV with columns (Name, Guardian name, Gender, Class, Roll no, Parent phone 1, Parent phone 2, DOB, Address). Validation pass returns per-row errors without writing; import writes only if zero errors, in one transaction, max 1,000 rows per file.

### 6.4 Attendance (FR-ATT-*)
- **BR-ATT-01** The list for class C on date D = students with an enrollment in C covering D (`from_date ≤ D ≤ coalesce(to_date, ∞)`), sorted by roll number.
- **BR-ATT-02** Saving is rejected with `NOT_WORKING_DAY` if `is_working_day(D)` is false.
- **BR-ATT-03** Saving is an upsert of the whole day (all students in one request) and is idempotent by (`class_id`, `date`). Concurrent edits use `version`; a stale version returns 409 with the latest data, and the client shows "Updated by <name> at <time> — review and save again".
- **BR-ATT-04** Notifications: for each student whose status changed to absent (or late, if enabled) in this save, queue one notification per linked parent. Re-saving without change sends nothing; changing absent → present sends nothing (no "correction" spam).
- **BR-ATT-05** Attendance % for a student over a period = (present + late) ÷ (present + late + absent) × 100, rounded to 1 decimal; "leave" days are excluded from the denominator and shown separately; unmarked days are excluded.
- **BR-ATT-06** "Not marked" = working day, class has ≥ 1 active student, no attendance_day row.

### 6.5 Results (FR-RES-*)
- **BR-RES-01** Marks-entry list = students in the subject (§5.2) whose enrollment in the class covers the assessment date.
- **BR-RES-02** Value rules: numeric with at most one decimal, step 0.5; 0 ≤ value ≤ total_marks; or absent. Invalid values are rejected per row with an error code; valid rows in the same request are saved (partial save allowed for drafts).
- **BR-RES-03** Publish requires every listed student to have a value or absent; otherwise `INCOMPLETE_MARKS` with the missing student IDs.
- **BR-RES-04** On publish: status = published, `published_at` set, marks become read-only, parents of each listed student get one notification. The in-app notification may show the result ("Physics Weekly Test 5: 21/25"); the push text stays generic per BR-NOT-02 ("New Physics result for Ali — tap to view"). Publishing is idempotent.
- **BR-RES-05** Unlock: status = unlocked with reason; teacher and admins may edit; republish sets `corrected_at`; parents whose child's value changed get a "corrected" notification; activity log records before/after per changed mark.
- **BR-RES-06** Percentage = value ÷ total × 100, rounded to 1 decimal. Grade = first grade_scale row (descending `min_percent`) with percentage ≥ `min_percent`. Absent shows "Absent" with no grade.
- **BR-RES-07** Class statistics exclude absent: average (1 decimal), highest, lowest, passed count (percentage ≥ pass %).
- **BR-RES-08** Position (if enabled) = standard competition ranking by value descending among non-absent students (ties share a position; next position skips).
- **BR-RES-09** Subject average for a student in a year = mean of percentages of **published** assessments for that class_subject, excluding absent; overall average = mean of the student's subject averages.
- **BR-RES-10** Exam group (admin creates for a whole class): creates one draft assessment per class_subject with the same type, title, date (per subject from the date sheet) and total marks, assigned to the current teacher.

### 6.6 Teaching Progress (FR-TPR-*)

**Topic status derivation**
- **BR-TPR-01** For each (class_subject, topic): status = `completed` if any lesson_log_topics row for that class_subject has status completed; else `started` if any has started; else `not_started`. `completed_on` = earliest lesson_log date with completed. Recomputed for affected topics in the same transaction whenever a lesson log is created, edited or deleted.
- **BR-TPR-02** Archived topics are excluded from all totals but keep their history.

**Coverage**
- **BR-TPR-03** `total_size` = Σ size of non-archived topics in the class_subject syllabus.
  `completed_size` = Σ size of topics with status completed.
  **Coverage % = completed_size ÷ total_size × 100** (1 decimal). If `total_size` = 0 → "No syllabus".
- **BR-TPR-04** Remaining topics = count of non-completed topics; remaining periods = Σ their sizes.

**Expected coverage (only if at least one chapter has a target date)**
- **BR-TPR-05** Order chapters by book order then chapter order. Let `cum(c)` = Σ topic sizes of all chapters up to and including c. Chapters without a target date inherit the next chapter's target date (and if none follow, the academic year end date).
  Let `T0` = academic year start date. For today `d`:
  - find the first chapter `c` with `target(c) ≥ d`; let `prev` = the previous chapter's target date (or `T0` for the first);
  - `fraction = working_days(prev, d) ÷ working_days(prev, target(c))` (exclusive of `prev`, inclusive of the end date; if the denominator is 0, fraction = 1);
  - **Expected size = cum(previous chapter) + size(c) × fraction**; **Expected % = expected size ÷ total_size × 100**.
  - If `d` is after the last target date, Expected % = 100.
- **BR-TPR-06** Difference = Coverage % − Expected % (percentage points). Status: **On track** if difference ≥ −5; **At risk** if −15 ≤ difference < −5; **Behind** if difference < −15 (thresholds configurable). Without target dates, status = "No target dates".

**Speed and projection**
- **BR-TPR-07** Speed = completed size whose `completed_on` falls in the last 20 working days ÷ 20 (size per working day). Projected finish = today + ceil(remaining periods ÷ speed) working days. If speed = 0 → "Not enough recent progress".

**Weekly plan**
- **BR-TPR-08** Week = Monday to Saturday (per working days). `is_late` = submitted after the deadline (default Monday 10:00 PKT) or not submitted by then (missing plans are shown as "Missing").
- **BR-TPR-09** Plan completion % for a week = number of planned topics whose status became completed with `completed_on` within that week (or that were completed in a lesson log dated within the week) ÷ number of planned topics × 100. Started-only topics do not count.
- **BR-TPR-10** "Copy to another class" copies topics by matching topic IDs when the syllabus was copied (same source), otherwise by identical chapter + topic title; unmatched topics are listed for the teacher.
- **BR-TPR-11** "Carry forward" adds last week's planned topics that are not completed.

**Lesson log**
- **BR-TPR-12** One lesson log per class_subject per date (upsert). A log with `no_lesson_reason` has no topics. Dedupe offline replays by `client_id`.
- **BR-TPR-13** Teacher edit allowed until `date` + 2 days 23:59 PKT; after that 403 `EDIT_WINDOW_CLOSED` for teachers.
- **BR-TPR-14** Homework audience = parents of students in the subject (§5.2) at creation time.

**Teacher progress summary (per teacher, period P)**
- **BR-TPR-15**
  - *Average difference* = mean of (Coverage − Expected) across the teacher's class_subjects that have target dates.
  - *Lesson-log days %* = (class_subject, working day) pairs in P with a lesson log (including "no lesson" with reason) ÷ all (class_subject, working day) pairs in P.
  - *Plans on time %* = weekly plans submitted on time ÷ (class_subjects × weeks in P).
  - *Tests published on time %* = assessments published ≤ 3 days after date ÷ assessments dated in P (and older than 3 days).
  - *Attendance marked %* (class teachers only) = marked working days ÷ working days.
  These are shown separately; no combined score in R1.

### 6.7 Fee Tracking (FR-FEE-*)
- **BR-FEE-01** Effective fee(student, at time t) = `student_fees.monthly_fee` if a row exists, else `class_fees.monthly_fee` for the student's current class; if neither exists → 0 and the student is flagged "Fee not set" on Super Admin screens.
- **BR-FEE-02** Monthly generation for month M (job on the 1st at 00:05 PKT, or manual trigger): for every student with an enrollment covering the first day of M, or starting within M if `fee_row_on_join` applies, insert a fee row (`status = unpaid`, `amount = effective fee now`, `class_id = current class`) using `INSERT … ON CONFLICT (student_id, month) DO NOTHING`. The job reports created/skipped counts.
- **BR-FEE-03** Mid-month join/re-admit: if `fee_row_on_join` is on and no row exists for the current month, create it at join time with the full effective fee.
- **BR-FEE-04** Fee change by Super Admin (class or student): affects rows created afterwards. If "also update this month" is ticked, update `amount` of the current month's rows that are **unpaid** for the affected students; paid and waived rows never change. Logged with sensitivity `finance_amount`.
- **BR-FEE-05** Mark paid/unpaid: transition unpaid ↔ paid; sets/clears `marked_by`, `marked_at`; optimistic `version`. Waived rows can be changed only by Super Admin (waived → unpaid un-waives). Each transition writes an activity log entry. Marking is allowed for months ≤ current month only.
- **BR-FEE-06** Parent notification on paid (setting `notify_parent_on_paid`, default on). If marked back to unpaid within 5 minutes, the pending push is cancelled if not yet sent.
- **BR-FEE-07** Counts for class C and month M (any role with access): `paid`, `unpaid`, `waived`, `total` over fee rows with `class_id = C` and `month = M`. "Remaining" = `unpaid`.
- **BR-FEE-08** Finance aggregates for month M (Super Admin only):
  - **Active students** = students with status active.
  - **Expected** = Σ amount of fee rows for M with status ≠ waived.
  - **Recovered** = Σ amount where status = paid.
  - **Pending** = Expected − Recovered.
  - **Recovery %** = Recovered ÷ Expected × 100 (1 decimal; "—" if Expected = 0).
  - **Monthly revenue at current fees** = Σ effective fee of all active students (not tied to rows).
  - By-class breakdown uses `fee_rows.class_id`.
  Totals are computed live with SQL aggregates (no cached totals) so they are always exact.
- **BR-FEE-09** "Unpaid 2+ months" = students (active or removed) with ≥ 2 fee rows in status unpaid; Admin sees list with months; Super Admin also sees amounts.
- **BR-FEE-10** Reminder (if enabled): on the configured day at 10:00, one notification per parent listing unpaid months of their children (one per parent, not per child).

### 6.8 Salaries (FR-SAL-*)
- **BR-SAL-01** Effective salary for month M = latest `salary_settings` row with `effective_from ≤ M` for the user.
- **BR-SAL-02** The monthly job (same as fees) inserts salary rows for every active user holding the teacher role (and admin staff with a salary setting) with an effective salary, `ON CONFLICT DO NOTHING`.
- **BR-SAL-03** A salary change with `effective_from` = current month updates the current month's row if pending; paid rows never change.
- **BR-SAL-04** Mark paid: Super Admin only; sets `paid_on` (default today) and note; can revert to pending (logged).
- **BR-SAL-05** `/me/salary` returns only rows where `user_id` = session user. No other endpoint returns salary data except Super Admin endpoints under `/salaries`.
- **BR-SAL-06** Net for month M (Super Admin) = Recovered(M) − Σ salary rows of M with status paid. A second figure "Planned net" = Expected(M) − Σ all salary rows of M.

### 6.9 Notifications (FR-NOT-*)
- **BR-NOT-01** Every notification is stored in `notifications` (in-app) and, if the user has push enabled for that category and has subscriptions, sent via Web Push by a queued job with retry (3 attempts, back-off 1/5/15 min). Subscriptions returning 404/410 are deleted.
- **BR-NOT-02** Push payloads contain only title, short text and a link — no marks values, fee amounts or salary figures in the push text for privacy on lock screens (e.g. "New result published for Ali — tap to view"). Full details (including marks) are visible in the in-app notification centre after opening the app.
- **BR-NOT-03** Daily summary (if the parent opts in): non-urgent events (homework, results) for the day are held and sent as one push at 19:00; absent alerts are always immediate.
- **BR-NOT-04** Announcements: audience resolved at publish time to user IDs; teachers can only choose their own classes (validated server-side).

### 6.10 Dashboards & Reports (FR-DSH-*)
- **BR-DSH-01** Dashboard queries run live against indexed tables; each response includes `as_of` timestamp. Target: ≤ 800 ms server time for the Super Admin overview at R1 capacity.
- **BR-DSH-02** Every report uses the same scoping and DTO rules as its screen (§5), including exports. Admin exports never contain amounts beyond per-student fee amount, and never salaries.
- **BR-DSH-03** Exports are generated server-side; files over 5,000 rows are generated by a job and delivered as a notification with a download link valid 24 h.

### 6.11 Activity Log & Settings (FR-ADM-*)

#### 6.11.1 Activity log
- **BR-ADM-01** Logged actions (minimum): those listed in PRD FR-ADM-01. Entry written in the same DB transaction as the change.
- **BR-ADM-02** Sensitivity: fee amount changes and waivers → `finance_amount`; salary settings and salary rows → `salary`; all else → `normal`. Admin queries filter to `normal`.
- **BR-ADM-03** No API exists to update or delete activity log entries.

#### 6.11.2 Settings (Super Admin; JSON schema-validated)
`registration_prefix`, `grade_scale[]`, `pass_percent`, `show_class_average_to_parents`, `show_position_to_parents`, `show_progress_status_to_parents`, `teacher_can_edit_syllabus`, `fee_row_on_join`, `notify_parent_on_paid`, `fee_reminder_enabled`, `fee_reminder_day`, `attendance_reminder_time`, `notify_late`, `weekly_plan_deadline` (weekday + time), `lesson_log_reminder_time`, `progress_thresholds {at_risk, behind}`. Defaults per PRD Appendix B.

---

## 7. Non-functional requirements

### 7.1 Performance
| ID | Requirement |
|---|---|
| NFR-PERF-01 | First load (cold, 4G "fast 3G" profile, mid-range Android): Largest Contentful Paint ≤ 3.0 s at p75; repeat visits ≤ 1.5 s (cached shell). |
| NFR-PERF-02 | Interaction to Next Paint ≤ 200 ms at p75; Cumulative Layout Shift ≤ 0.1. |
| NFR-PERF-03 | JavaScript per route ≤ 170 KB gzipped; images served as WebP/AVIF, responsive sizes; uploads compressed on device to ≤ 1600 px longest side and ≤ 500 KB where possible. |
| NFR-PERF-04 | API p95 ≤ 500 ms for reads and ≤ 800 ms for writes at R1 capacity; attendance save for 60 students ≤ 500 ms server time. |
| NFR-PERF-05 | Monthly fee + salary generation for 3,000 students completes ≤ 2 min. |
| NFR-PERF-06 | Lists paginate at 50 items with search on the server; class lists (≤ 80 students) load in one request. |

### 7.2 Reliability and data safety
| ID | Requirement |
|---|---|
| NFR-REL-01 | Availability ≥ 99.5% per month (excluding announced maintenance between 23:00–06:00 PKT). |
| NFR-REL-02 | Drafts for attendance, marks, lesson logs, weekly plans and homework saved to IndexedDB on every change; restored after app restart. |
| NFR-REL-03 | Offline queue: writes made offline are queued with a `client_id` and replayed in order when online; server deduplicates; conflicts (409) are surfaced to the user, never silently overwritten. |
| NFR-REL-04 | All multi-step changes are single database transactions (e.g. add student, publish results, remove student). |
| NFR-REL-05 | Jobs are idempotent and safe to re-run; failed jobs retry and alert the Super Admin's system notifications after final failure. |
| NFR-REL-06 | Backups: automated daily snapshots retained 30 days; point-in-time recovery window ≥ 7 days; **RPO ≤ 15 min, RTO ≤ 4 h**; restore tested quarterly. Object store has versioning on. |

### 7.3 Security (see §10)
NFR-SEC-01 … NFR-SEC-12 in §10.

### 7.4 Usability and accessibility
| ID | Requirement |
|---|---|
| NFR-UX-01 | WCAG 2.2 AA: contrast ≥ 4.5:1 text; touch targets ≥ 24 px minimum (design target 48 px); labels; focus visible; no colour-only status. |
| NFR-UX-02 | Layout correct from 320 px to 1920 px; text scaling to 200% without loss of content. |
| NFR-UX-03 | Task time targets on a mid-range Android: attendance for 40 students ≤ 30 s; marks for 40 students ≤ 3 min; lesson log ≤ 45 s; fee marking one student ≤ 3 s. Verified in usability tests. |
| NFR-UX-04 | All user-facing strings in translation files; RTL-safe CSS (logical properties) so Urdu (R1.1) needs no layout rewrite. |

### 7.5 Capacity and scalability
| ID | Requirement |
|---|---|
| NFR-CAP-01 | Support 3,000 active students, 6,000 parent accounts, 150 teachers, 10 admins, 5 years of history, with 3× headroom on a single app instance + managed Postgres. |
| NFR-CAP-02 | Peak load: 200 teachers saving attendance within 10 minutes; 1,500 parents opening the app within 15 minutes after a results publish. |
| NFR-CAP-03 | Stateless app servers so a second instance can be added behind a load balancer without code changes. |

### 7.6 Maintainability
| ID | Requirement |
|---|---|
| NFR-MNT-01 | Strict TypeScript; lint and format in CI; migrations versioned and reversible where possible. |
| NFR-MNT-02 | Unit test coverage ≥ 80% for business-rule modules (fees, progress, results, permissions). |
| NFR-MNT-03 | API documented with OpenAPI generated from schemas. |

### 7.7 Compatibility
NFR-CMP-01: Android 9+ Chrome/Samsung Internet; iOS 16.4+ Safari (push only when installed); desktop current − 1. UC Browser/Opera Mini: login and read-only views must work; entry screens may show "Please use Chrome for the best experience".

---

## 8. External interfaces

### 8.1 User interface
As specified in PRD §4, §5 and §8. Design tokens: 4-pt spacing grid, 16 px base font, semantic colours (primary, success, warning, danger, neutral) for light and dark themes.

### 8.2 PWA
- Web app manifest: name, short name, icons (192, 512, maskable), `display: standalone`, theme colour, start URL per role home.
- Service worker: precache app shell; runtime cache (stale-while-revalidate) for read APIs a user has viewed, max 24 h, cleared on logout; no caching of salary or finance endpoints; background sync where supported, else replay on app focus.
- Install prompt: Android `beforeinstallprompt`; iOS instruction sheet when `display-mode` is not standalone.

### 8.3 API (REST, JSON, `/api/v1`)
Conventions: cookie session auth; `Content-Type: application/json`; errors as `{ "error": { "code": "CLASS_HAS_STUDENTS", "message": "...", "details": {...} } }`; pagination `?cursor=&limit=`; `If-Match: <version>` for concurrent-edit resources; `Idempotency-Key` header (= `client_id`) on offline-queued POST/PUT.

| Area | Endpoints (method path — roles) |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/logout` · `POST /auth/logout-all` · `POST /auth/setup` (token + password) · `POST /auth/switch-role` · `GET /me` · `PATCH /me` · `POST /me/password` |
| Users | `POST /users` (create teacher/parent: SA, A; admin: SA) · `GET /users?role=` · `POST /users/{id}/setup-link` · `POST /users/{id}/deactivate` · `POST /users/{id}/activate` |
| Academy | `GET/PATCH /academy` (SA) · `GET/PATCH /settings` (SA) · `GET/POST /academic-years` · `POST /academic-years/{id}/make-current` · `POST /academic-years/{id}/copy-from/{prevId}` · `GET/POST/DELETE /holidays` |
| Classes | `GET/POST /classes` · `GET/PATCH /classes/{id}` · `POST /classes/{id}/archive` · `GET/POST /classes/{id}/subjects` · `PUT /class-subjects/{id}/teacher` · `GET/POST /subjects` |
| Students | `GET /students?q=&classId=&status=&feeStatus=&month=` · `POST /students` · `GET/PATCH /students/{id}` · `POST /students/{id}/move` · `POST /students/{id}/remove` · `POST /students/{id}/readmit` · `DELETE /students/{id}` (SA) · `POST /students/import?dryRun=` · `POST /promotions` |
| Attendance | `GET /classes/{id}/attendance?date=` · `PUT /classes/{id}/attendance?date=` · `GET /students/{id}/attendance?from=&to=` · `GET /attendance/today` (SA, A) · `GET /classes/{id}/attendance/register?month=` |
| Results | `GET /assessments?classSubjectId=&status=` · `POST /assessments` · `POST /exam-groups` · `GET/PATCH /assessments/{id}` · `PUT /assessments/{id}/marks` · `POST /assessments/{id}/publish` · `POST /assessments/{id}/unlock` · `POST /assessments/{id}/correction-request` · `GET /students/{id}/results` · `GET /classes/{id}/result-sheet?examGroupId=|classSubjectId=` |
| Progress | `GET/PUT /class-subjects/{id}/syllabus` · `POST /class-subjects/{id}/syllabus/copy-to` · `POST /class-subjects/{id}/syllabus/import` · `GET /class-subjects/{id}/progress` · `GET/PUT /weekly-plans?classSubjectId=&week=` · `POST /weekly-plans/{id}/submit` · `POST /weekly-plans/{id}/copy-to` · `POST /weekly-plans/{id}/comments` · `GET/PUT /class-subjects/{id}/lesson-logs?date=` · `GET/POST /homework` · `GET /students/{id}/this-week` · `GET /progress/dashboard` (SA, A) · `GET /teachers/{id}/progress-summary?period=` (SA, A, self) |
| Fees | `GET/PUT /classes/{id}/fee` (SA) · `GET/PUT/DELETE /students/{id}/fee` (SA) · `GET /fees/rows?classId=&month=&status=` (SA, A, T*) · `POST /fees/rows/{id}/paid` · `POST /fees/rows/{id}/unpaid` · `POST /fees/rows/{id}/waive` (SA) · `POST /fees/generate?month=` (SA, A) · `GET /fees/overview?month=` (SA, A — counts) · `GET /fees/unpaid-multiple` (SA, A) · `GET /finance/summary?month=` (SA) · `GET /finance/trend?months=12` (SA) · `GET /students/{id}/fees` (SA, A, P) |
| Salaries | `GET /salaries?month=` (SA) · `PUT /users/{id}/salary` (SA) · `POST /salaries/rows/{id}/paid` (SA) · `POST /salaries/rows/{id}/pending` (SA) · `GET /me/salary` (self) |
| Notify | `GET/POST /announcements` · `GET /notifications` · `POST /notifications/read` · `POST /push/subscribe` · `DELETE /push/subscribe` · `GET/PUT /me/notification-preferences` |
| Dashboards | `GET /dashboard/super-admin` · `GET /dashboard/admin` · `GET /dashboard/teacher` · `GET /dashboard/parent?studentId=` · `GET /people-status` (SA) |
| Reports | `GET /reports/{reportKey}?format=pdf|xlsx&...` |
| Audit | `GET /activity?entityType=&entityId=&actorId=&from=&to=` (SA; A filtered) |

\* Teacher responses omit `amount`.

### 8.4 Push
Web Push (RFC 8030) with VAPID keys stored as secrets; payload encrypted per spec; TTL 24 h; urgency `high` for absent alerts, `normal` otherwise.

### 8.5 File storage
Private bucket; object keys `academy/<id>/<type>/<uuid>.<ext>`; uploads via short-lived pre-signed PUT URLs (5 min) after server validation of type and size; downloads via pre-signed GET URLs (10 min) issued only after a permission check. Allowed: JPEG, PNG, WebP, PDF; max 5 MB per file; max 5 files per homework/announcement.

---

## 9. Scheduled jobs (all times PKT)

| Job | Schedule | Behaviour |
|---|---|---|
| `monthly-rows` | 1st of month 00:05 | BR-FEE-02 and BR-SAL-02; reports counts to Super Admin system notifications |
| `attendance-reminder` | Working days at `attendance_reminder_time` | Class teachers of unmarked classes; admins at 12:00 |
| `lesson-log-reminder` | Working days at 18:00 | Teachers with class_subjects lacking a log today |
| `weekly-plan-reminder` | Monday at deadline | Teachers with missing plans |
| `results-reminder` | Daily 10:00 | Teachers with draft assessments dated ≥ 3 days ago |
| `fee-reminder` | `fee_reminder_day` 10:00 (if enabled) | BR-FEE-10 |
| `parent-daily-summary` | Daily 19:00 | BR-NOT-03 |
| `push-sender` | Continuous queue | BR-NOT-01 |
| `export-builder` | Queue | BR-DSH-03 |
| `cleanup` | Daily 03:00 | Expired sessions/tokens; old notifications; parent access after 30-day window |

Jobs use a single-instance lock (pg-boss singleton) so they never run twice concurrently.

---

## 10. Security and privacy

| ID | Requirement |
|---|---|
| NFR-SEC-01 | HTTPS everywhere with HSTS; TLS 1.2+. |
| NFR-SEC-02 | Passwords Argon2id; sessions per BR-AUTH-07; login rate limit 10 requests/min per IP and 5 failures per account (BR-AUTH-06). |
| NFR-SEC-03 | CSRF protection: SameSite=Lax cookies + `Origin` header check on all state-changing requests. |
| NFR-SEC-04 | Authorization per §5 on every endpoint; automated permission test suite covering every endpoint × role (allowed and denied cases) runs in CI and blocks merge on failure. |
| NFR-SEC-05 | Field-level DTOs: separate serializers per role; tests assert that teacher fee responses contain no `amount` and that no non-Super-Admin response contains salary or revenue keys. |
| NFR-SEC-06 | Input validation with shared schemas; parameterised queries only (ORM); output encoding in UI; Content-Security-Policy restricting scripts to self. |
| NFR-SEC-07 | Security headers: CSP, X-Content-Type-Options, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, frame-ancestors none. |
| NFR-SEC-08 | Encryption at rest for database, backups and object storage (managed provider). Secrets in the hosting platform's secret store, never in code. |
| NFR-SEC-09 | Uploads: type checked by content (magic bytes), size limits, private storage, signed URLs (§8.5). |
| NFR-SEC-10 | Dependency vulnerability scanning in CI; critical issues fixed before release. |
| NFR-SEC-11 | Pre-launch security review against OWASP Top 10 and ASVS Level 2 checklist (authentication, session, access control, validation, data protection). |
| NFR-SEC-12 | Logs never contain passwords, tokens, or full setup links; phone numbers masked in logs (`+92300*****67`). |

**Privacy**
- **PRV-01** Collect only what the PRD lists; CNIC/B-Form numbers are **not** collected in R1.
- **PRV-02** Student photos and attachments are private; never placed in public URLs or push payloads.
- **PRV-03** Parents see only their own children; teachers see only students of their classes; enforced by §5.
- **PRV-04** Data requests: Super Admin can export all data about a student/parent (Excel) and, for removed students past the academy's retention period, anonymise personal fields while keeping aggregate academic and financial records.
- **PRV-05** Incident response: if a breach is suspected, Super Admin is informed within 24 h, affected users within 72 h; steps documented in the operations runbook.
- **PRV-06** The system follows Pakistan's PECA 2016 (as amended) and is designed to align with the draft Personal Data Protection Bill principles (consent, purpose limitation, security, access) so it is ready if the law is enacted. Legal review recommended before launch.

---

## 11. Testing and acceptance

### 11.1 Test levels
| Level | Scope | Tooling (suggested) |
|---|---|---|
| Unit | Business rules: BR-FEE-*, BR-SAL-*, BR-TPR-*, BR-RES-*, BR-ATT-05, phone normalisation, working days | Vitest/Jest |
| Permission suite | Every endpoint × every role × allowed/denied, including DTO field checks (§10 NFR-SEC-04/05) | Integration tests on a test DB |
| Integration | Transactions: add/remove/move student; publish/unlock; monthly job idempotency; offline replay dedupe | Test DB + API tests |
| End-to-end | Journeys J1–J6 (PRD §7) on a 360 × 640 viewport and desktop | Playwright |
| Performance | Lighthouse CI on mobile profile (NFR-PERF-01–03); load test NFR-CAP-02 | Lighthouse CI, k6 |
| Accessibility | Automated checks + manual screen-reader pass on core screens | axe-core, TalkBack, VoiceOver |
| Device testing | At least 3 real Android phones (one low-end with 2–3 GB RAM), 1 iPhone | Manual |
| Usability | 3 teachers + 3 parents + 1 admin complete core tasks within NFR-UX-03 targets | Moderated sessions |

### 11.2 Key acceptance tests (must pass)
1. **Fee totals:** PRD §6.7 example — Expected Rs 222,000, Recovered Rs 176,500, Pending Rs 45,500, Recovery 79.5%.
2. **Fee job idempotency:** running `monthly-rows` twice for the same month creates zero extra rows.
3. **Fee change rules:** BR-FEE-04 both with and without "also update this month"; paid rows unchanged.
4. **Teacher fee privacy:** teacher fee-list response has no `amount` field; teacher cannot mark a student outside their classes (403).
5. **Salary privacy:** Admin → `GET /salaries` 403; Admin `GET /users/{teacherId}` has no salary fields; Teacher A → only own `/me/salary`; Teacher A cannot access Teacher B salary via any endpoint.
6. **Coverage:** total size 120, completed 66 → 55.0%; expected 70.0% → Behind; plan 6 topics, 4 completed → 66.7%.
7. **Expected % interpolation:** given chapter targets and holidays, computed expected % matches a hand-calculated sheet to 0.1.
8. **Results lock:** published marks reject edits (409/403) until unlocked; correction logged with before/after; parent sees "Corrected".
9. **Marks validation:** 27 on total 25 rejected; 17.5 accepted; 17.3 rejected.
10. **Remove student:** disappears from next-day attendance and next-month fee generation; history intact; parent read-only for 30 days then no access.
11. **Class archive blocked** with students; allowed after moving them.
12. **Offline:** attendance captured in airplane mode is submitted once after reconnection; duplicate replays are ignored.
13. **Notifications:** absent push received on Android Chrome and installed iOS PWA; push text contains no marks/fee amounts.
14. **Activity log:** every action in FR-ADM-01 creates an entry; Admin cannot see salary/fee-amount entries.

### 11.3 Release quality gates
All acceptance tests pass · zero open critical/high bugs · permission suite 100% · Lighthouse mobile performance ≥ 85 and accessibility ≥ 95 on core screens · backup restore rehearsed · security review sign-off.

---

## 12. Environments, deployment, backup and monitoring

### 12.1 Environments
| Env | Purpose | Data |
|---|---|---|
| Development | Local work | Seed/fake data |
| Staging | QA, pilot rehearsal, demos | Anonymised copy or synthetic data |
| Production | Live academy | Real data |

### 12.2 Deployment
- Container image built in CI (e.g. GitHub Actions) on merge to main → automated tests → deploy to staging → manual approval → production.
- Database migrations run automatically before the new version receives traffic; backward-compatible migrations (expand → migrate → contract) to allow zero-downtime deploys.
- Hosting: a managed container platform or a VPS with Docker, plus managed PostgreSQL in a region with low latency to Pakistan (e.g. Middle East or South Asia regions; measure latency from Lahore/Karachi before choosing). CDN in front for static assets.
- Rollback: previous image redeployable within 10 minutes; migrations designed to be compatible with the previous version.

### 12.3 Backup and recovery
Per NFR-REL-06. Quarterly restore drill to staging with checksum comparison of row counts for key tables (students, marks, fee_rows, salary_rows).

### 12.4 Monitoring and alerting
- Error tracking (client and server) with release tags.
- Uptime checks on `/health` every minute; alert owner/engineer on 2 consecutive failures.
- Metrics: request latency p95, error rate, job success/failure, push delivery failures, DB connections and slow queries (> 500 ms logged).
- Super Admin "System health" card: last backup time, last monthly job result, push failures in last 24 h.

---

## 13. Traceability (PRD → SRS)

| PRD area | Requirement IDs | SRS sections |
|---|---|---|
| Roles & permissions | PRD §3 | §5 (5.1–5.5), §10 NFR-SEC-04/05 |
| Accounts & Roles | FR-AUTH-01 … 10 | §6.1 BR-AUTH-01 … 09; §8.3 Auth/Users |
| Academy Setup | FR-ORG-01 … 09 | §6.2 BR-ORG-01 … 05; §4 classes/subjects/years |
| Students | FR-STU-01 … 12 | §6.3 BR-STU-01 … 08; §5.3 |
| Attendance | FR-ATT-01 … 09 | §6.4 BR-ATT-01 … 06; §9 reminders |
| Results | FR-RES-01 … 12 | §6.5 BR-RES-01 … 10 |
| Teaching Progress | FR-TPR-01 … 13 | §6.6 BR-TPR-01 … 15 |
| Fee Tracking | FR-FEE-01 … 14 | §6.7 BR-FEE-01 … 10; §5.4; §11.2 tests 1–4 |
| Teacher Salaries | FR-SAL-01 … 06 | §6.8 BR-SAL-01 … 06; §5.4; §11.2 test 5 |
| Announcements & Notifications | FR-NOT-01 … 05 | §6.9 BR-NOT-01 … 04; §8.4; §9 |
| Dashboards & Reports | FR-DSH-01 … 06 | §6.10 BR-DSH-01 … 03 |
| Activity Log & Settings | FR-ADM-01 … 04 | §6.11 |
| UX | UX-01 … 13 | §7.4, §8.1, §8.2 |
| Non-functional | PRD §10 | §7, §10, §12 |
