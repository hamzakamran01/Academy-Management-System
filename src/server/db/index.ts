import "server-only";
import { connect, runMigrations, type Connection, type Database } from "./connect";
import * as schema from "./schema";

declare global {
  var __campuslyDb: Promise<Connection> | undefined;
}

async function open(): Promise<Connection> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and paste your connection string.");
  const conn = await connect(url, { max: Number(process.env.DB_POOL_MAX ?? 10) });
  if (url === "pglite://memory") {
    const demo = process.env.CAMPUSLY_NO_DEMO !== "1";
    // Zero-setup dev: fresh schema + demo academy on every boot.
    const { join } = await import("node:path");
    await runMigrations(conn, join(process.cwd(), "database", "migrations"));
    if (demo) {
      const { seedDemo } = await import("./demo");
      await seedDemo(conn.db);
      console.log("[campusly] in-memory demo database ready — sign in with 0300 0000001 / Campusly#2026");
    }
  }
  return conn;
}

// One pool per server process; reused across hot reloads in development.
const conn = globalThis.__campuslyDb ?? open();
globalThis.__campuslyDb = conn;

export const db: Database = (await conn).db;

export type DB = Database;
/** A transaction or the root db — services accept either so they compose inside one transaction. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

export { schema };
