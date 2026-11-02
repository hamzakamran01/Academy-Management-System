import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// `npm run db:generate` writes plain, numbered SQL files into /database/migrations.
// They can be run by hand in the Supabase / Neon SQL editor or with `npm run db:migrate`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./database/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/campusly",
  },
  strict: true,
  verbose: true,
});
