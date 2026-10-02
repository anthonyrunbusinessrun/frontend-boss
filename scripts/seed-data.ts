import type { Pool, PoolClient } from "pg";
import type { RecordSet } from "../src/types";
import { accounts } from "../src/data/accounts";
import { actions } from "../src/data/actions";
import { capabilities } from "../src/data/capabilities";
import { categories } from "../src/data/categories";
import { concepts } from "../src/data/concepts";
import { folios } from "../src/data/folios";
import { forms } from "../src/data/forms";
import { items } from "../src/data/items";
import { leads } from "../src/data/leads";
import { packet } from "../src/data/packet";
import { profiles } from "../src/data/profiles";
import { registries } from "../src/data/registries";
import { transactions } from "../src/data/transactions";
import { vouchers } from "../src/data/vouchers";

type SeedRow = { id: string };

const sections: Array<{ slug: string; name: string; data: RecordSet<SeedRow> }> = [
  { slug: "profiles", name: "Profiles", data: profiles as RecordSet<SeedRow> },
  { slug: "categories", name: "Categories", data: categories as RecordSet<SeedRow> },
  { slug: "folios", name: "Folios", data: folios as RecordSet<SeedRow> },
  { slug: "actions", name: "Actions", data: actions as RecordSet<SeedRow> },
  { slug: "packet", name: "Packet", data: packet as RecordSet<SeedRow> },
  { slug: "vouchers", name: "Vouchers", data: vouchers as RecordSet<SeedRow> },
  { slug: "transactions", name: "Transactions", data: transactions as RecordSet<SeedRow> },
  { slug: "items", name: "Items", data: items as RecordSet<SeedRow> },
  { slug: "accounts", name: "Accounts", data: accounts as RecordSet<SeedRow> },
  { slug: "forms", name: "Forms", data: forms as RecordSet<SeedRow> },
  { slug: "concepts", name: "Concepts", data: concepts as RecordSet<SeedRow> },
  { slug: "capabilities", name: "Capabilities", data: capabilities as RecordSet<SeedRow> },
  { slug: "leads", name: "Leads", data: leads as RecordSet<SeedRow> },
  { slug: "registries", name: "Registries", data: registries as RecordSet<SeedRow> },
];

async function seedSection(client: PoolClient, section: (typeof sections)[number]) {
  const range = section.data.range;
  await client.query(
    `INSERT INTO boss_sections
      (slug, display_name, airtable_table_name, range_from, range_to, range_total)
     VALUES ($1, $2, $2, $3, $4, $5)
     ON CONFLICT (slug) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       airtable_table_name = EXCLUDED.airtable_table_name,
       range_from = EXCLUDED.range_from,
       range_to = EXCLUDED.range_to,
       range_total = EXCLUDED.range_total,
       updated_at = NOW()`,
    [section.slug, section.name, range?.from ?? null, range?.to ?? null, range?.total ?? null],
  );

  for (const [groupPosition, group] of section.data.groups.entries()) {
    await client.query(
      `INSERT INTO boss_groups
        (section_slug, group_id, label, display_count, sums, position)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (section_slug, group_id) DO UPDATE SET
         label = EXCLUDED.label,
         display_count = EXCLUDED.display_count,
         sums = EXCLUDED.sums,
         position = EXCLUDED.position`,
      [section.slug, group.id, group.label ?? null, group.count ?? null, JSON.stringify(group.sums ?? null), groupPosition],
    );

    for (const [rowPosition, row] of group.rows.entries()) {
      await client.query(
        `INSERT INTO boss_records (section_slug, record_id, group_id, position, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (section_slug, record_id) DO UPDATE SET
           group_id = EXCLUDED.group_id,
           position = EXCLUDED.position,
           data = EXCLUDED.data,
           updated_at = NOW()`,
        [section.slug, row.id, group.id, rowPosition, JSON.stringify(row)],
      );
    }
  }
}

export async function seedDatabase(pool: Pool, options: { onlyWhenEmpty?: boolean } = {}) {
  if (options.onlyWhenEmpty) {
    const count = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM boss_sections");
    if (count.rows[0].count !== "0") return false;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const section of sections) await seedSection(client, section);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
