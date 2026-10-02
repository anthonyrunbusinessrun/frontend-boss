import "server-only";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var bossPostgresPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  return new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  });
}

export const db = globalThis.bossPostgresPool ?? createPool();

if (process.env.NODE_ENV !== "production" && db) {
  globalThis.bossPostgresPool = db;
}

export function requireDb(): Pool {
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}

