import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __campuslySql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and paste your connection string.");
  return postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 15,
    // Supabase / Neon transaction poolers do not support prepared statements.
    prepare: false,
  });
}

// Reuse one pool across hot reloads in development.
const client = globalThis.__campuslySql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__campuslySql = client;

export const db = drizzle(client, { schema });

export type DB = PostgresJsDatabase<typeof schema>;
/** A transaction or the root db — services accept either so they compose inside one transaction. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

export { schema };
