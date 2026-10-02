import "server-only";
import type { RecordGroup, RecordSet } from "@/types";
import { requireDb } from "@/lib/db";

export const sectionNames = {
  profiles: "Profiles",
  categories: "Categories",
  folios: "Folios",
  actions: "Actions",
  packet: "Packet",
  vouchers: "Vouchers",
  transactions: "Transactions",
  items: "Items",
  accounts: "Accounts",
  forms: "Forms",
  concepts: "Concepts",
  capabilities: "Capabilities",
  leads: "Leads",
  registries: "Registries",
} as const;

export type DataSection = keyof typeof sectionNames;

export function isDataSection(value: string): value is DataSection {
  return value in sectionNames;
}

type JsonRow = { id: string; [key: string]: unknown };

export async function getRecordSet<T extends { id: string }>(section: DataSection): Promise<RecordSet<T>> {
  const pool = requireDb();
  const [rangeResult, groupResult, rowResult] = await Promise.all([
    pool.query<{ range_from: number | null; range_to: number | null; range_total: number | null }>(
      `SELECT range_from, range_to, range_total FROM boss_sections WHERE slug = $1`,
      [section],
    ),
    pool.query<{ group_id: string; label: string | null; display_count: number | null; sums: Record<string, string | number> | null }>(
      `SELECT group_id, label, display_count, sums
       FROM boss_groups WHERE section_slug = $1 ORDER BY position`,
      [section],
    ),
    pool.query<{ group_id: string; data: T }>(
      `SELECT group_id, data FROM boss_records
       WHERE section_slug = $1 ORDER BY group_id, position`,
      [section],
    ),
  ]);

  if (rangeResult.rowCount === 0) throw new Error(`Unknown section: ${section}`);

  const rowsByGroup = new Map<string, T[]>();
  for (const row of rowResult.rows) {
    const rows = rowsByGroup.get(row.group_id) ?? [];
    rows.push(row.data);
    rowsByGroup.set(row.group_id, rows);
  }

  const groups: RecordGroup<T>[] = groupResult.rows.map((group) => ({
    id: group.group_id,
    ...(group.label === null ? {} : { label: group.label }),
    ...(group.display_count === null ? {} : { count: group.display_count }),
    ...(group.sums === null ? {} : { sums: group.sums }),
    rows: rowsByGroup.get(group.group_id) ?? [],
  }));

  const rangeRow = rangeResult.rows[0];
  return {
    groups,
    ...(rangeRow.range_from === null || rangeRow.range_to === null || rangeRow.range_total === null
      ? {}
      : { range: { from: rangeRow.range_from, to: rangeRow.range_to, total: rangeRow.range_total } }),
  };
}

export async function createRecord(section: DataSection, groupId: string, data: JsonRow) {
  const pool = requireDb();
  const result = await pool.query<{ data: JsonRow }>(
    `INSERT INTO boss_records (section_slug, record_id, group_id, position, data)
     VALUES ($1, $2, $3,
       COALESCE((SELECT MAX(position) + 1 FROM boss_records WHERE section_slug = $1 AND group_id = $3), 0),
       $4::jsonb)
     RETURNING data`,
    [section, data.id, groupId, JSON.stringify(data)],
  );
  return result.rows[0].data;
}

export async function updateRecord(section: DataSection, id: string, patch: Record<string, unknown>) {
  const pool = requireDb();
  const safePatch = { ...patch };
  delete safePatch.id;
  const result = await pool.query<{ data: JsonRow }>(
    `UPDATE boss_records
     SET data = data || $3::jsonb, updated_at = NOW()
     WHERE section_slug = $1 AND record_id = $2
     RETURNING data`,
    [section, id, JSON.stringify(safePatch)],
  );
  return result.rows[0]?.data ?? null;
}

export async function deleteRecord(section: DataSection, id: string) {
  const pool = requireDb();
  const result = await pool.query(
    `DELETE FROM boss_records WHERE section_slug = $1 AND record_id = $2`,
    [section, id],
  );
  return (result.rowCount ?? 0) > 0;
}

export function authorizeMutation(request: Request) {
  const expected = process.env.API_WRITE_TOKEN;
  if (!expected) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${expected}`;
}
