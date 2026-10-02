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
  await seedDatabase(pool);
  console.log("Database seed completed");
} finally {
  await pool.end();
}

