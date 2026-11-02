/**
 * Applies database/migrations/*.sql in order (tracked in `_migrations`).
 * Equivalent to running each file by hand in the Supabase / Neon SQL editor.
 *
 *   npm run db:migrate                  apply pending files
 *   npm run db:migrate -- --baseline    files were already run by hand: only record them
 */
import "dotenv/config";
import { connect, runMigrations } from "../src/server/db/connect";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const conn = await connect(url, { max: 1 });
  try {
    const baseline = process.argv.includes("--baseline");
    const n = await runMigrations(conn, "database/migrations", console.log, { baseline });
    console.log(n ? `✓ ${n} migration(s) applied` : "✓ Database already up to date");
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error("✗ Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
