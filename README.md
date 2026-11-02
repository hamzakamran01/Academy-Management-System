# Campusly

**The academy, on every phone.** Campusly is a mobile-first, installable web app (PWA) that gives an academy's
owner, office admins, teachers and parents one truthful, connected record of students, results,
teaching progress, fees and salaries.

- Product vision → [`docs/vision.md`](docs/vision.md)
- What we build → [`docs/PRD.md`](docs/PRD.md)
- How it must behave → [`docs/SRS.md`](docs/SRS.md)

---

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router) · React 19 · TypeScript (strict) |
| UI | Tailwind CSS v4 design tokens · Radix primitives · lucide icons · mobile-first (360 px) · light by default with an opt-in Dark theme (More → Appearance) |
| Data | PostgreSQL 16 (Supabase recommended, Mumbai region) · Drizzle ORM · plain SQL migrations |
| Auth | Phone + password · Argon2id · DB-backed sessions in HttpOnly cookies · role context per session |
| Validation | Zod schemas shared by UI and API |
| Offline | Service worker + IndexedDB (Dexie) drafts and write queue |
| Push | Web Push (VAPID) — free, Android + installed iOS PWAs |
| Jobs | Idempotent cron endpoints (`/api/v1/cron/*`) — callable by Vercel Cron, Supabase `pg_cron` or any scheduler |

## Architecture (modular monolith)

```
src/
  app/                  Next.js routes
    (auth)/             login, account setup link
    (app)/              signed-in shell — role-aware bottom nav (phone) / sidebar (desktop)
    api/v1/             REST API (SRS §8.3) — used by client mutations, offline queue, future native app
  components/ui/        design system primitives (Button, Card, Sheet, Badge, StatusChip, …)
  components/shell/     app shell, navigation, headers
  lib/                  client-safe utilities (formatting, phone, dates, i18n strings)
  server/
    db/                 Drizzle schema + client
    auth/               sessions, passwords, current-user context
    policy/             permission checks and role scoping (SRS §5) — every request goes through here
    modules/<module>/   business services: org, students, results, progress, fees, salaries, notify, audit
database/
  migrations/           numbered .sql files (run in order)
  seed/                 initial academy + Super Admin
```

Rules every module follows:

1. **Authenticate → role context → policy check → scoped query → role-specific DTO** (SRS §5.1). UI hiding is cosmetic.
2. Salary data and revenue totals never leave the server except to the Super Admin (and a teacher's own salary).
3. Multi-step writes are a single transaction and write the activity log in the same transaction.
4. Money is integer rupees; times stored in UTC, shown and scheduled in Asia/Karachi.

## Execution plan

Phases are ordered by dependency and business priority. Every phase ends with a working, tested slice.

| # | Phase | Scope | PRD refs | Status |
|---|---|---|---|---|
| 0 | **Foundation** | Repo, tooling, design system, app shell, PWA manifest | UX-01…12 | ✅ |
| 1 | **Data model** | Full schema (all modules), SQL migrations, seed | SRS §4 | ✅ |
| 2 | **Accounts & roles** | Phone login, setup links + WhatsApp share, sessions, role switch, lockout, policy layer | AUTH-01…10 | ✅ |
| 3 | **Academy setup** | Years, working days, holidays, classes, subjects, teacher assignment, archive rules | ORG-01…09 | ✅ |
| 4 | **Students** | Add (with parent linking), edit, move, remove, re-admit, profile, search | STU-01…10 | ✅ |
| 5 | ~~Attendance~~ | **Deferred by owner (2 Nov 2026)** — tables kept, no screens or APIs in R1 | ATT-01…09 | ⏸ |
| 6 | **Fees** | Class/personal fees, monthly rows, mark paid with undo, overviews, Finance | FEE-01…14 | ✅ |
| 7 | **Results** | Tests, marks in front of names, publish/lock/unlock/correct, stats, trends | RES-01…11 | ✅ |
| 8 | **Teaching progress** | Syllabus builder, weekly plan, lesson log, homework, coverage/expected/status | TPR-01…13 | ✅ |
| 9 | **Salaries** | Salary settings, monthly rows, mark paid, My Salary, net | SAL-01…06 | ✅ |
| 10 | **Notifications** | Announcements, notification centre, web push, reminders | NOT-01…05 | ✅ |
| 11 | **Dashboards & reports** | Role homes, people status, exports, activity log, settings | DSH, ADM | ✅ |
| 12 | **Hardening** | Offline queue, permission test suite, accessibility & performance pass | SRS §7, §11 | ✅ |

## Getting started

### Option A — instant demo (no database to set up)

```bash
npm install
echo 'DATABASE_URL="pglite://memory"' > .env
npm run dev
```

An in-memory Postgres boots with every migration applied and a realistic demo academy (4 classes,
~50 students, syllabi with lesson history, published tests, fees and salaries). It resets on restart.
Sign in at http://localhost:3000 with password **Campusly#2026**:

| Role | Mobile |
|---|---|
| Owner (Super Admin) | 0300 0000001 |
| Admin | 0300 0000002 |
| Teacher | 0300 0000003 |
| Parent (2 children) | 0300 0000004 |

### Option B — Supabase (staging / production)

1. Create a Supabase project in the **Mumbai (ap-south-1)** region.
2. In **SQL Editor**, run each file in `database/migrations` in order: `0000` → `0001` → `0002` → `0003` …
   (or put the connection string in `.env` and run `npm run db:migrate`; if you already ran files by hand,
   run `npm run db:migrate -- --baseline` once so they're recorded).
3. `cp .env.example .env` and set `DATABASE_URL` (Transaction pooler, port 6543).
4. `npm run db:seed -- --phone 03xxxxxxxxx --name "Owner Name" --academy "Academy Name"` → prints the owner's setup link.
5. `npm run dev` and open the setup link.

### Environment variables

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Postgres connection (or `pglite://memory` for the demo) |
| `APP_URL` | Public URL used inside setup links shared on WhatsApp |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push — generate with `npm run vapid` |
| `CRON_SECRET` | Protects `/api/v1/cron/*` |

### Scheduled jobs

Everything time-based runs through one endpoint, `GET /api/v1/cron/tick` (header `Authorization: Bearer $CRON_SECRET`).
Each tick runs whatever is due in Pakistan time — monthly fee & salary lists (1st, 00:05), lesson-log and weekly-plan
reminders, results reminders, fee reminders, 7 pm parent summaries and cleanup — and `job_runs` guarantees each job
runs once per period, so extra or overlapping ticks are harmless. Push notifications are sent immediately after each
action and don't depend on the scheduler.

| Where | How |
|---|---|
| **Vercel Hobby (free)** | `vercel.json` runs the tick **once a day** at 00:05 PKT (Hobby allows only daily crons) — enough for the monthly lists. |
| **GitHub Actions (free)** | `.github/workflows/cron.yml` ticks **every 15 minutes** for reminders. Add repo secrets **APP_URL** (your Vercel URL) and **CRON_SECRET** (same as in Vercel): GitHub → Settings → Secrets and variables → Actions. |
| **Your PC (testing)** | `npm run cron:local` (every 15 min) or `npm run cron:local -- 1` (every minute) while `npm run dev` runs. |

### Deploying (Vercel + Supabase)

1. Import the repo in Vercel, set the environment variables above (`APP_URL` = your domain).
2. Run the migrations against Supabase (step 2 above), then the seed script once for the owner.
3. Deploy. The owner opens the setup link, then adds classes, subjects, teachers and students.

## Quality

```bash
npm run typecheck   # strict TypeScript
npm run lint
npm test            # 42 tests on a real in-memory Postgres
```

The suite covers the PRD/SRS acceptance tests: exact finance totals (222,000 / 176,500 / 45,500 / 79.5 %),
fee-job idempotency, fee-change rules, teacher fee privacy, salary privacy, coverage/expected/status maths,
marks validation, result lock & correction with audit trail, and a role-by-role permission suite.

## Scope notes

- **Attendance** is deferred by the owner; its tables exist so it can be switched on later without a migration.
- Urdu interface, printable report cards (PDF) and CSV student import are planned for R1.1 (PRD §11.2).
