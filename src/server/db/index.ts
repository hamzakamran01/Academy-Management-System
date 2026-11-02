import "server-only";
import { connect, type Connection, type Database } from "./connect";
import * as schema from "./schema";

declare global {
  var __campuslyDb: Promise<Connection> | undefined;
}

function open(): Promise<Connection> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and paste your connection string.");
  return connect(url, { max: Number(process.env.DB_POOL_MAX ?? 10) });
}

// One pool per server process; reused across hot reloads in development.
const conn = globalThis.__campuslyDb ?? open();
globalThis.__campuslyDb = conn;

export const db: Database = (await conn).db;

export type DB = Database;
/** A transaction or the root db — services accept either so they compose inside one transaction. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

export { schema };
