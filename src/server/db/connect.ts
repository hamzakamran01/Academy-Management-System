/**
 * Database connection factory shared by the app, scripts and tests.
 *
 *   postgres://… / postgresql://…  → postgres.js (Supabase, Neon, any Postgres)
 *   pglite://./.data/campusly       → embedded PGlite on disk (zero-setup local dev)
 *   pglite://memory                 → in-memory PGlite (tests)
 */
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

export type Connection = {
  db: Database;
  kind: "postgres" | "pglite";
  close: () => Promise<void>;
  /** Raw multi-statement exec (migrations). */
  exec: (sql: string) => Promise<void>;
};

export async function connect(url: string, opts: { max?: number } = {}): Promise<Connection> {
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
    const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
    const { drizzle } = await import("drizzle-orm/pglite");
    const path = url.replace(/^pglite:\/\//, "");
    if (path !== "memory") (await import("node:fs")).mkdirSync(path, { recursive: true });
    const client = new PGlite(path === "memory" ? undefined : path, { extensions: { pg_trgm, pgcrypto } });
    await client.waitReady;
    // PGlite and postgres.js drizzle instances share the same query-builder API.
    const db = drizzle(client, { schema }) as unknown as Database;
    return {
      db,
      kind: "pglite",
      close: () => client.close(),
      exec: async (sql) => {
        await client.exec(sql);
      },
    };
  }
  const client = postgres(url, {
    max: opts.max ?? 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false, // Supabase / Neon transaction poolers don't support prepared statements
    onnotice: () => {},
  });
  return {
    db: drizzlePg(client, { schema }),
    kind: "postgres",
    close: () => client.end(),
    exec: async (sql) => {
      await client.unsafe(sql);
    },
  };
}

/** Apply database/migrations/*.sql in order, tracking applied files in `_migrations`. */
export async function runMigrations(conn: Connection, dir: string, log: (m: string) => void = () => {}): Promise<number> {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  await conn.exec(`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const { sql } = await import("drizzle-orm");
  const done = new Set((await rows<{ name: string }>(conn.db, sql`select name from _migrations`)).map((r) => r.name));
  let applied = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    const body = readFileSync(join(dir, file), "utf8");
    const statements = body.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    await conn.exec("BEGIN");
    try {
      for (const st of statements) await conn.exec(st);
      await conn.exec(`INSERT INTO _migrations (name) VALUES ('${file.replace(/'/g, "''")}')`);
      await conn.exec("COMMIT");
    } catch (err) {
      await conn.exec("ROLLBACK");
      throw new Error(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
    log(`✓ ${file}`);
    applied++;
  }
  return applied;
}

/** Normalise db.execute() results across drivers (postgres.js returns an array, PGlite returns { rows }). */
export async function rows<T>(db: Database, query: import("drizzle-orm").SQL): Promise<T[]> {
  const res = (await db.execute(query)) as unknown;
  return (Array.isArray(res) ? res : ((res as { rows?: T[] }).rows ?? [])) as T[];
}
