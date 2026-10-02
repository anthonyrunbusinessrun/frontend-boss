import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { seedDatabase } from "./seed-data";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

try {
  const schema = await fs.readFile(path.join(process.cwd(), "db/schema.sql"), "utf8");
  await pool.query(schema);
  await seedDatabase(pool, { onlyWhenEmpty: true });
  console.log("Database schema is ready");
} finally {
  await pool.end();
}

