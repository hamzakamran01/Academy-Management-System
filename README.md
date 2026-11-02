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
| UI | Tailwind CSS v4 design tokens · Radix primitives · lucide icons · mobile-first (360 px) |
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

Phases are ordered by dependency and business priority. Every phase ends with a working, committed slice.

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
| 9 | **Salaries** | Salary settings, monthly rows, mark paid, My Salary, net | SAL-01…06 | 🔄 |
| 10 | **Notifications** | Announcements, notification centre, web push, reminders | NOT-01…05 | ⏳ |
| 11 | **Dashboards & reports** | Role homes, people status, exports, activity log, settings | DSH, ADM | ⏳ |
| 12 | **Hardening** | Offline queue, permission test suite, accessibility & performance pass | SRS §7, §11 | ⏳ |

## Getting started

### Option A — zero setup (embedded Postgres on your machine)

```bash
npm install
echo 'DATABASE_URL="pglite://./.data/campusly"' > .env
npm run db:migrate
npm run db:seed -- --phone 03001234567 --name "Your Name" --academy "Your Academy"
npm run dev            # open the printed setup link and set a password
```

> Stop `npm run dev` before running scripts against PGlite — it allows one process at a time.

### Option B — Supabase (staging / production)

1. Create a Supabase project in the **Mumbai (ap-south-1)** region.
2. In **SQL Editor**, run each file in `database/migrations` in order (`0000` → `0001` → `0002` …).
   Or paste the pooled connection string into `.env` and run `npm run db:migrate`.
3. `cp .env.example .env` and set `DATABASE_URL` (Transaction pooler, port 6543).
4. `npm run db:seed -- --phone 03xxxxxxxxx --name "Owner Name" --academy "Academy Name"`
5. `npm run dev` and open the printed setup link.

Open http://localhost:3000 on your phone (same Wi-Fi) or in the browser's mobile emulator.
