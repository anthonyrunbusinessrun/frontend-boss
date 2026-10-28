import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { applyBaseMigrations } from "../src/server/base/migrate";
import { seedDatabase } from "./seed-data";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const schema = await fs.readFile(path.join(process.cwd(), "db/schema.sql"), "utf8");
    await pool.query(schema);
    const seeded = await seedDatabase(pool, { onlyWhenEmpty: true });
    // Field/view definitions and one-time relationship backfills. Idempotent and non-destructive.
    const report = await applyBaseMigrations(pool, { freshSeed: seeded });
    console.log(`Table engine: ${report.tables} tables, +${report.fieldsAdded} fields, +${report.viewsAdded} views`);
    for (const b of report.backfills) console.log(`  ${b.id}: ${b.detail}`);
    console.log("Database schema is ready");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
