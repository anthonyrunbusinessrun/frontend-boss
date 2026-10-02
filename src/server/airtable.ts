import "server-only";
import type { PoolClient } from "pg";
import { requireDb } from "@/lib/db";

export type AirtableImport = {
  slug: string;
  displayName: string;
  viewName: string;
  columns: string[];
  records: Record<string, string>[];
};

function validSlug(value: string) {
  return /^[a-z0-9-]{1,64}$/.test(value);
}

export function validateAirtableImport(value: unknown): value is AirtableImport {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<AirtableImport>;
  if (
    typeof input.slug !== "string" ||
    !validSlug(input.slug) ||
    typeof input.displayName !== "string" ||
    input.displayName.length > 120 ||
    typeof input.viewName !== "string" ||
    input.viewName.length > 120 ||
    !Array.isArray(input.columns) ||
    input.columns.length > 250 ||
    input.columns.some((column) => typeof column !== "string") ||
    !Array.isArray(input.records) ||
    input.records.length > 10_000
  ) {
    return false;
  }

  return input.records.every(
    (record) => record !== null && typeof record === "object" && !Array.isArray(record),
  );
}

async function insertRows(client: PoolClient, tableSlug: string, records: Record<string, string>[]) {
  if (records.length === 0) return;
  await client.query(
    `INSERT INTO airtable_records (table_slug, row_number, data)
     SELECT $1, (source.ordinality - 1)::integer, source.value
     FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS source(value, ordinality)`,
    [tableSlug, JSON.stringify(records)],
  );
}

export async function replaceAirtableTable(input: AirtableImport) {
  const pool = requireDb();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO airtable_tables
         (slug, display_name, source_view_name, columns, record_count, imported_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
       ON CONFLICT (slug) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         source_view_name = EXCLUDED.source_view_name,
         columns = EXCLUDED.columns,
         record_count = EXCLUDED.record_count,
         imported_at = NOW()`,
      [input.slug, input.displayName, input.viewName, JSON.stringify(input.columns), input.records.length],
    );
    await client.query("DELETE FROM airtable_records WHERE table_slug = $1", [input.slug]);
    await insertRows(client, input.slug, input.records);
    await client.query("COMMIT");
    return { table: input.slug, records: input.records.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listAirtableTables() {
  const pool = requireDb();
  const result = await pool.query<{
    slug: string;
    display_name: string;
    source_view_name: string;
    columns: string[];
    record_count: number;
    imported_at: Date;
  }>(
    `SELECT slug, display_name, source_view_name, columns, record_count, imported_at
     FROM airtable_tables ORDER BY display_name`,
  );
  return result.rows.map((row) => ({
    slug: row.slug,
    displayName: row.display_name,
    viewName: row.source_view_name,
    columns: row.columns,
    recordCount: row.record_count,
    importedAt: row.imported_at,
  }));
}

export async function getAirtableTable(slug: string, limit: number, offset: number) {
  if (!validSlug(slug)) return null;
  const pool = requireDb();
  const [tableResult, rowResult] = await Promise.all([
    pool.query<{
      slug: string;
      display_name: string;
      source_view_name: string;
      columns: string[];
      record_count: number;
      imported_at: Date;
    }>(
      `SELECT slug, display_name, source_view_name, columns, record_count, imported_at
       FROM airtable_tables WHERE slug = $1`,
      [slug],
    ),
    pool.query<{ row_number: number; data: Record<string, string> }>(
      `SELECT row_number, data FROM airtable_records
       WHERE table_slug = $1 ORDER BY row_number LIMIT $2 OFFSET $3`,
      [slug, limit, offset],
    ),
  ]);
  const table = tableResult.rows[0];
  if (!table) return null;
  return {
    slug: table.slug,
    displayName: table.display_name,
    viewName: table.source_view_name,
    columns: table.columns,
    recordCount: table.record_count,
    importedAt: table.imported_at,
    offset,
    limit,
    records: rowResult.rows.map((row) => ({ rowNumber: row.row_number, data: row.data })),
  };
}
