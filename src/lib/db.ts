import "server-only";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var bossPostgresPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  const pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  });
  // An idle connection can be dropped when the database restarts or fails over. Without a listener the
  // 'error' event would crash the whole server; the pool replaces the connection on the next query.
  pool.on("error", (error) => console.error("[db] idle connection error:", error.message));
  return pool;
}

export const db = globalThis.bossPostgresPool ?? createPool();

if (process.env.NODE_ENV !== "production" && db) {
  globalThis.bossPostgresPool = db;
}

export function requireDb(): Pool {
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}

