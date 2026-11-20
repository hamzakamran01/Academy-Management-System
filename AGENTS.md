# Campusly

Read [README.md](README.md), [PRD](docs/PRD.md), and [SRS](docs/SRS.md) before changing a workflow. The app is a Next.js App Router PWA with role-scoped server modules and Drizzle over PostgreSQL.

- Enforce role and academy scope on the server. Keep sensitive finance changes and their audit entries in the same transaction.
- Store money as integer rupees and use the Pakistan date helpers for business periods.
- Use the shared UI primitives and semantic tokens. Check key workflows at 360 px and on desktop, including dark mode where practical.
- Apply numbered SQL migrations in order. Use an isolated PGlite database for local verification.
- Run `npm run typecheck`, `npm run lint`, and `npm test` before handing off a change.
