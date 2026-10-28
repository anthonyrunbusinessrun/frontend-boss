import type { Pool, PoolClient } from "pg";
import { defaultFormConfig } from "@/lib/base/viewDefaults";
import { TABLES, VOUCHER_DOCUMENT_KEYS, VOUCHER_START, seedViewConfig, type TableSeed } from "@/lib/base/definitions";
import type { FieldDef } from "@/lib/base/types";

/**
 * Applies the table engine's definitions to a database. Safe to run on every start:
 *  - field/view/section definitions are inserted only when missing and never overwrite user edits;
 *  - data backfills are recorded in `boss_migrations` and run once;
 *  - nothing is deleted. Legacy record properties (`cord`, `category`, `group`…) stay in place.
 * No `server-only` import: this module is also used by scripts/migrate.ts.
 */
export interface MigrationReport {
  tables: number;
  fieldsAdded: number;
  viewsAdded: number;
  backfills: Array<{ id: string; detail: string }>;
  /** Things that could not be applied and need a person (for example duplicate codes blocking a unique index). */
  warnings: string[];
}

async function once(client: PoolClient, id: string, run: () => Promise<string>, report: MigrationReport) {
  const done = await client.query("SELECT 1 FROM boss_migrations WHERE id = $1", [id]);
  if (done.rowCount) return;
  const notes = await run();
  await client.query("INSERT INTO boss_migrations (id, notes) VALUES ($1, $2)", [id, notes]);
  report.backfills.push({ id, detail: notes });
}

async function applyTable(client: PoolClient, seed: TableSeed, report: MigrationReport) {
  const exists = await client.query("SELECT 1 FROM boss_sections WHERE slug = $1", [seed.slug]);
  if (!exists.rowCount) return; // table not present in this database (e.g. an empty install without seed)
  report.tables += 1;

  for (const [i, f] of seed.fields.entries()) {
    const res = await client.query(
      `INSERT INTO boss_fields (table_slug, key, name, type, options, position, required, is_primary)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7,
         $8 AND NOT EXISTS (SELECT 1 FROM boss_fields WHERE table_slug = $1 AND is_primary))
       ON CONFLICT (table_slug, key) DO NOTHING`,
      [seed.slug, f.key, f.name, f.type, JSON.stringify(f.options ?? {}), i, f.required ?? false, f.primary ?? false],
    );
    report.fieldsAdded += res.rowCount ?? 0;
  }

  await once(
    client,
    `defaults:${seed.slug}`,
    async () => {
      const existing = await client.query("SELECT COUNT(*)::int AS n FROM boss_views WHERE table_slug = $1", [seed.slug]);
      if (existing.rows[0].n > 0) return "views already present; defaults skipped";

      const fieldRows = await client.query<{ key: string; name: string; type: FieldDef["type"]; options: FieldDef["options"]; required: boolean; is_primary: boolean; position: number }>(
        "SELECT key, name, type, options, required, is_primary, position FROM boss_fields WHERE table_slug = $1 ORDER BY position",
        [seed.slug],
      );
      const fields: FieldDef[] = fieldRows.rows.map((r) => ({ key: r.key, name: r.name, type: r.type, options: r.options, required: r.required, primary: r.is_primary, position: r.position }));

      const sectionIds = new Map<string, string>();
      let rootPos = 0;
      const posInSection = new Map<string, number>();
      for (const v of seed.views) {
        let sectionId: string | null = null;
        let position = 0;
        if (v.section) {
          let id = sectionIds.get(v.section);
          if (!id) {
            id = `sec_${seed.slug}_${v.section.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            sectionIds.set(v.section, id);
            await client.query("INSERT INTO boss_nav_sections (id, table_slug, name, position) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING", [id, seed.slug, v.section, rootPos]);
            rootPos += 1;
          }
          sectionId = id;
          position = posInSection.get(id) ?? 0;
          posInSection.set(id, position + 1);
        } else {
          position = rootPos;
          rootPos += 1;
        }
        const config = seedViewConfig(v);
        if (v.type === "form") config.form = defaultFormConfig(fields, seed.name);
        if (v.type === "form" && v.key === "team-onboarding") {
          // Onboarding collects the essentials only; everything else stays editable on the profile.
          const show = new Set(["name", "contact", "position", "type", "email", "billing", "sal", "phone1", "photo", "team"]);
          config.form = { ...config.form!, title: "New team member", description: "Add a person to the BOSS team directory.", successMessage: "Team member added.", fields: config.form!.fields.map((f) => ({ ...f, visible: show.has(f.key) })) };
        }
        await client.query(
          `INSERT INTO boss_views (id, table_slug, name, type, config, access, section_id, position)
           VALUES ($1, $2, $3, $4, $5::jsonb, 'collaborative', $6, $7) ON CONFLICT (id) DO NOTHING`,
          [`view_${seed.slug}_${v.key}`, seed.slug, v.name, v.type, JSON.stringify(config), sectionId, position],
        );
        report.viewsAdded += 1;
      }
      return `${seed.views.length} default views`;
    },
    report,
  );
}

async function counterFor(client: PoolClient, table: string, key: string, start: number) {
  await client.query(
    `INSERT INTO boss_counters (table_slug, key, next_value)
     SELECT $1, $2, GREATEST($3::bigint, COALESCE((SELECT MAX((data->>$2)::bigint) + 1 FROM boss_records WHERE section_slug = $1 AND data->>$2 ~ '^[0-9]+$'), $3::bigint))
     ON CONFLICT (table_slug, key) DO NOTHING`,
    [table, key, start],
  );
}

async function backfills(client: PoolClient, report: MigrationReport) {
  const hasProfiles = (await client.query("SELECT 1 FROM boss_sections WHERE slug = 'profiles'")).rowCount;
  const hasFolios = (await client.query("SELECT 1 FROM boss_sections WHERE slug = 'folios'")).rowCount;

  if (hasProfiles) {
    // The existing Profiles table is the BOSS team directory (Agents and Reps), so those records become team members.
    // Only rows without the flag are touched; an explicit false is never overwritten.
    await once(
      client,
      "v1:profiles-team-flags",
      async () => {
        const r = await client.query(
          `UPDATE boss_records SET data = data || jsonb_build_object(
             'team', CASE WHEN jsonb_typeof(data->'team') = 'boolean' THEN data->'team' ELSE 'true'::jsonb END,
             'inactive', CASE WHEN jsonb_typeof(data->'inactive') = 'boolean' THEN data->'inactive' ELSE 'false'::jsonb END), updated_at = NOW()
           WHERE section_slug = 'profiles' AND (NOT data ? 'team' OR NOT data ? 'inactive')`,
        );
        return `${r.rowCount} profiles flagged as team members / active`;
      },
      report,
    );
  }

  if (hasFolios) {
    await once(
      client,
      "v1:folios-assignee-category-links",
      async () => {
        const assignee = await client.query(
          `UPDATE boss_records f
             SET data = f.data || jsonb_build_object('assigneeId', p.record_id), updated_at = NOW()
           FROM boss_records p
           WHERE f.section_slug = 'folios' AND p.section_slug = 'profiles'
             AND NOT f.data ? 'assigneeId'
             AND NULLIF(btrim(f.data->>'cord'), '') IS NOT NULL
             AND lower(p.data->>'contact') = lower(btrim(f.data->>'cord'))
             AND (SELECT COUNT(*) FROM boss_records p2 WHERE p2.section_slug = 'profiles' AND lower(p2.data->>'contact') = lower(btrim(f.data->>'cord'))) = 1`,
        );
        const category = await client.query(
          `UPDATE boss_records f
             SET data = f.data || jsonb_build_object('categoryId', c.record_id), updated_at = NOW()
           FROM boss_records c
           WHERE f.section_slug = 'folios' AND c.section_slug = 'categories'
             AND NOT f.data ? 'categoryId'
             AND NULLIF(btrim(f.data->>'category'), '') IS NOT NULL
             AND lower(c.data->>'code') = lower(btrim(f.data->>'category'))
             AND (SELECT COUNT(*) FROM boss_records c2 WHERE c2.section_slug = 'categories' AND lower(c2.data->>'code') = lower(btrim(f.data->>'category'))) = 1`,
        );
        const unmatched = await client.query(
          `SELECT
             COUNT(*) FILTER (WHERE NULLIF(btrim(data->>'cord'), '') IS NOT NULL AND NOT data ? 'assigneeId')::int AS cords,
             COUNT(*) FILTER (WHERE NULLIF(btrim(data->>'category'), '') IS NOT NULL AND NOT data ? 'categoryId')::int AS cats
           FROM boss_records WHERE section_slug = 'folios'`,
        );
        const u = unmatched.rows[0];
        return `linked ${assignee.rowCount} assignees and ${category.rowCount} categories; ${u.cords} cord and ${u.cats} category values had no unique match and keep their original text`;
      },
      report,
    );
  }

  // Autonumbers: give existing records a number and make sure the counter continues after the highest one.
  const vouchers = (await client.query("SELECT 1 FROM boss_sections WHERE slug = 'vouchers'")).rowCount;
  if (vouchers) {
    await once(
      client,
      "v1:vouchers-autonumber",
      async () => {
        await counterFor(client, "vouchers", "i", VOUCHER_START);
        const r = await client.query(
          `WITH missing AS (
             SELECT r.record_id, ROW_NUMBER() OVER (ORDER BY g.position, r.position, r.record_id) AS rn
             FROM boss_records r JOIN boss_groups g ON g.section_slug = r.section_slug AND g.group_id = r.group_id
             WHERE r.section_slug = 'vouchers' AND NOT r.data ? 'i'
           ), base AS (SELECT next_value AS v FROM boss_counters WHERE table_slug = 'vouchers' AND key = 'i')
           UPDATE boss_records r SET data = r.data || jsonb_build_object('i', (SELECT v FROM base) + m.rn - 1), updated_at = NOW()
           FROM missing m WHERE r.section_slug = 'vouchers' AND r.record_id = m.record_id`,
        );
        await client.query(`UPDATE boss_counters SET next_value = next_value + $1 WHERE table_slug = 'vouchers' AND key = 'i'`, [r.rowCount]);
        return `${r.rowCount} vouchers numbered`;
      },
      report,
    );
  }
  const items = (await client.query("SELECT 1 FROM boss_sections WHERE slug = 'items'")).rowCount;
  if (items) await once(client, "v1:items-autonumber", async () => { await counterFor(client, "items", "n", 1); return "item counter ready"; }, report);
}

/**
 * Views added to a table after its first release. Inserted once per view (recorded in boss_migrations), so a view the
 * team later deletes or edits is never brought back or overwritten.
 */
async function applyLateViews(client: PoolClient, report: MigrationReport) {
  for (const seed of TABLES) {
    const exists = await client.query("SELECT 1 FROM boss_sections WHERE slug = $1", [seed.slug]);
    if (!exists.rowCount) continue;
    const existing = await client.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM boss_views WHERE table_slug = $1", [seed.slug]);
    if (existing.rows[0].n === 0) continue; // fresh table: `defaults:` already inserted every seed view
    for (const v of seed.views) {
      if (v.section) continue;
      await once(
        client,
        `view:${seed.slug}:${v.key}`,
        async () => {
          const id = `view_${seed.slug}_${v.key}`;
          const present = await client.query("SELECT 1 FROM boss_views WHERE id = $1", [id]);
          if (present.rowCount) return "already present";
          const pos = await client.query<{ p: number }>(
            `SELECT COALESCE(MAX(p) + 1, 0)::int AS p FROM (SELECT position AS p FROM boss_views WHERE table_slug = $1 AND section_id IS NULL UNION ALL SELECT position FROM boss_nav_sections WHERE table_slug = $1) x`,
            [seed.slug],
          );
          await client.query(
            `INSERT INTO boss_views (id, table_slug, name, type, config, access, position) VALUES ($1, $2, $3, $4, $5::jsonb, 'collaborative', $6)
             ON CONFLICT (id) DO NOTHING`,
            [id, seed.slug, v.name, v.type, JSON.stringify(seedViewConfig(v)), pos.rows[0].p],
          );
          report.viewsAdded += 1;
          return `added view “${v.name}”`;
        },
        report,
      );
    }
  }
}

/** A unique index per generated code is the database-level guarantee behind the server's counter. */
async function ensureSequenceIndexes(client: PoolClient, report: MigrationReport) {
  for (const seed of TABLES) {
    for (const f of seed.fields) {
      if (!f.options?.sequence) continue;
      const exists = await client.query("SELECT 1 FROM boss_sections WHERE slug = $1", [seed.slug]);
      if (!exists.rowCount) continue;
      if (!/^[a-z_]+$/.test(seed.slug) || !/^[A-Za-z]+$/.test(f.key)) continue; // constants from definitions.ts; belt and braces
      await client.query("SAVEPOINT seq_index");
      try {
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS boss_seq_${seed.slug}_${f.key} ON boss_records ((data->>'${f.key}')) WHERE section_slug = '${seed.slug}'`);
        await client.query("RELEASE SAVEPOINT seq_index");
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT seq_index");
        report.warnings.push(`Unique index for ${seed.slug}.${f.key} was not created (existing duplicate codes?): ${(error as Error).message}. The server still prevents new duplicates.`);
      }
    }
  }
}

async function backfillsV3(client: PoolClient, report: MigrationReport) {
  // Voucher PDFs are no longer created, uploaded or replaced by the app: every voucher shows the supplied Voucher.pdf.
  // The three PDF fields from the previous release are removed from the field list. Values already stored in records
  // (and any stored files) are kept in the database untouched.
  await once(
    client,
    "v3:vouchers-remove-pdf-fields",
    async () => {
      const r = await client.query("DELETE FROM boss_fields WHERE table_slug = 'vouchers' AND key IN ('pdf', 'generatedPdf', 'pdfStatus')");
      return `${r.rowCount} PDF field definitions removed (stored values kept)`;
    },
    report,
  );
}

async function backfillsV2(client: PoolClient, report: MigrationReport) {
  const has = async (slug: string) => (await client.query("SELECT 1 FROM boss_sections WHERE slug = $1", [slug])).rowCount;

  if (await has("forms")) {
    // Existing forms were all “Work” forms (the only style they had).
    await once(
      client,
      "v2:forms-category-work",
      async () => {
        const r = await client.query(
          `UPDATE boss_records SET data = data || '{"category":"Work"}'::jsonb, updated_at = NOW()
           WHERE section_slug = 'forms' AND (NOT data ? 'category' OR data->>'category' IS NULL OR data->>'category' = '')`,
        );
        // Form views (the view type) get the same default category so none is left without one.
        const v = await client.query(
          `UPDATE boss_views SET config = jsonb_set(config, '{form,category}', '"Work"'::jsonb), updated_at = NOW()
           WHERE type = 'form' AND config ? 'form' AND NOT (config->'form' ? 'category')`,
        );
        return `${r.rowCount} forms and ${v.rowCount} form views set to category Work`;
      },
      report,
    );
  }

  if (await has("vouchers")) {
    await once(
      client,
      "v2:voucher-document-defaults",
      async () => {
        // Vouchers before the PDF workflow were Bills of Lading with status Issued.
        const r = await client.query(
          `UPDATE boss_records SET data = data || jsonb_build_object('docType', COALESCE(NULLIF(data->>'docType', ''), 'BL'), 'docStatus', COALESCE(NULLIF(data->>'docStatus', ''), 'Issued')), updated_at = NOW()
           WHERE section_slug = 'vouchers'`,
        );
        // The new document columns start hidden in the compact views, like the earlier detail fields.
        const views = await client.query<{ id: string; config: { hidden?: string[]; key?: string } }>("SELECT id, config FROM boss_views WHERE table_slug = 'vouchers'");
        let touched = 0;
        for (const v of views.rows) {
          const hide = v.config.key === "simplified" || v.config.key === "ledger";
          if (!hide) continue;
          const hidden = [...new Set([...(v.config.hidden ?? []), ...VOUCHER_DOCUMENT_KEYS])];
          await client.query("UPDATE boss_views SET config = jsonb_set(config, '{hidden}', $2::jsonb), updated_at = NOW() WHERE id = $1", [v.id, JSON.stringify(hidden)]);
          touched += 1;
        }
        return `${r.rowCount} vouchers typed BL / Issued; document columns hidden in ${touched} views`;
      },
      report,
    );
  }
}

/** Sample content for a freshly seeded database only (never applied to an existing one). */
async function freshExtras(client: PoolClient) {
  const merge = (slug: string, id: string, data: Record<string, unknown>) =>
    client.query("UPDATE boss_records SET data = data || $3::jsonb WHERE section_slug = $1 AND record_id = $2", [slug, id, JSON.stringify(data)]);

  // Capabilities: the five System capabilities and four Exceptions are transcribed from the supplied Airtable screenshots.
  for (const [i, id] of ["cp1", "cp2", "cp3", "cp4", "cp5", "cp6", "cp7"].entries()) await merge("capabilities", id, { go: true, sort: i + 1, ...(i < 5 ? { area: "System" } : {}) });
  const exceptions: Array<[string, string, string]> = [
    ["Responder Base Camps", "CAP-108", "Land Logistics provides full responder base camp services for FEMA, military, and emergency response operations. Base camps deliver the complete life-support package for mission teams deployed to disaster zones: dining facility, lodging pods, restrooms, hand washing stations, water supply, power generation, and gray water collection."],
    ["Roofing & Construction Supplies", "CAP-109", "Land Logistics sources, consolidates, and delivers roofing materials and building supply products to disaster-impacted areas under emergency timelines, with end-to-end delivery from CONUS sourcing through air cargo to OCONUS islands."],
    ["Motor Coach & Passenger Logistics", "CAP-110", "Land Logistics provides mass passenger transportation services for disaster evacuations, high-profile events, and government missions, with live 24/7 dispatch and a broad carrier network."],
    ["Heavy Equipment Rental", "CAP-111", "Land Logistics provides heavy equipment rental and operator services for debris management, construction support, and emergency response operations."],
  ];
  const lastGroup = await client.query<{ group_id: string }>("SELECT group_id FROM boss_groups WHERE section_slug = 'capabilities' ORDER BY position DESC LIMIT 1");
  if (lastGroup.rows[0]) {
    for (const [i, [title, code, overview]] of exceptions.entries()) {
      const id = `cp${8 + i}`;
      const data = { id, code, title, overview, gallery: "", notes: "", attachment: "", features: [], tagline: "", go: true, sort: 8 + i, area: "Exception" };
      await client.query(
        `INSERT INTO boss_records (section_slug, record_id, group_id, position, data) VALUES ('capabilities', $1, $2, 100 + $3, $4::jsonb) ON CONFLICT DO NOTHING`,
        [id, lastGroup.rows[0].group_id, i, JSON.stringify(data)],
      );
    }
  }

  // Items: SKU, unit, category and reorder level for the sample inventory.
  const itemMeta: Record<string, [string, string]> = { i1: ["Feeding", "BF-0001"], i2: ["Feeding", "BF-0002"], i3: ["Feeding", "BF-0003"], i4: ["Diapering", "DP-0001"], i5: ["Feeding", "FD-0001"], i6: ["Hygiene", "HY-0001"], i7: ["Comfort", "CM-0001"], i8: ["Comfort", "CM-0002"], i9: ["Diapering", "DP-0002"], i10: ["Hygiene", "HY-0002"] };
  for (const [id, [category, sku]] of Object.entries(itemMeta)) await merge("items", id, { category, sku, unit: "each", reorderLevel: 100 });

  // Vouchers. v1 carries the fields printed on the supplied FEMA / Infant & Toddler voucher; v2 is a Bill of Lading.
  const terms = "Carrier accepts full responsibility for claim, loss, or damage occurring during transport. All applicable DOT regulations must be observed throughout the duration of haul. Hours of Service limitations must be communicated to shipper prior to or at time of dispatch. Failure to deliver the listed quantity, weight, or configuration may result in rate adjustment or claim deduction. Signed Proof of Delivery is required for freight payment.";
  await merge("vouchers", "v1", {
    docType: "FD",
    docStatus: "Issued",
    headline: "ASN - DELIVERED",
    vsf: "VSF",
    manifest: "I/T-015 · GREENCASTLE · Wipes",
    accrualDate: "2026-07-09",
    vendorCode: "FEMA-HQ",
    vendorAccount: "Federal Emergency Management Agency\n500 C Street SW\nWashington, DC 20472",
    contractNo: "70FB7026F00000036",
    operatorCode: "DC-GRC",
    operatedBy: "FEMA DC Greencastle\n12316 Molly Pitcher Hwy\nGreencastle, PA 17225\n(301) 874-4200",
    deliverVia: "SAIA LTL Freight",
    deliverPhone: "(609) 807-9228",
    deliverPhone2: "800-456-7296",
    resource: "LTL EXPRESS",
    tracking: "5188241",
    voucherNote: "",
    terms,
    manifestLines: "I/T-015 | I/T-015 · GREENCASTLE · Wipes | Diaper Baby Wipe Fragrance Free | 7/13/2026 | 10859120630",
    packLines: "I/T-015 | 80 Wipes/Bag | 1 Pallet · 220 lbs · 40x48x55 | 24 | 1440 | FEMA DC GREENCASTLE / 12316 Molly Pitcher Highway / Greencastle, PA 17225",
  });
  const address = "Land Logistics\n304 SW Suwannee Avenue\nBranford, Florida 32008\n(202) 875-2320";
  await merge("vouchers", "v2", {
    docType: "BL",
    docStatus: "Issued",
    headline: "BILL OF LADING",
    vsf: "VSF",
    manifest: "D/O - LAND BRANFORD HQ · Pallet of Wipes",
    accrualDate: "2026-07-27",
    vendorCode: "LLG",
    vendorAccount: address,
    operatedBy: address,
    deliverVia: "Total Quality Logistics",
    deliverPhone: "(513) 831-2600",
    resource: "FTL",
    tracking: "37702098",
    voucherNote: "Delivery to Branford HQ dock.",
    terms: "Shipment is tendered in accordance with applicable regulations and contract requirements.",
    manifestLines: "D/O | D/O - LAND BRANFORD HQ | Pallet of Wipes | 7/28/2026 | 37702098",
    packLines: "D/O | 80 Wipes/Bag | 1 Pallet | 24 | 1440 | Land Logistics / 304 SW Suwannee Avenue / Branford, Florida 32008",
  });
}

export async function applyBaseMigrations(pool: Pool, opts: { freshSeed?: boolean } = {}): Promise<MigrationReport> {
  const report: MigrationReport = { tables: 0, fieldsAdded: 0, viewsAdded: 0, backfills: [], warnings: [] };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('boss-base-migrate'))");
    for (const seed of TABLES) await applyTable(client, seed, report);
    await backfills(client, report);
    await applyLateViews(client, report);
    await backfillsV2(client, report);
    await backfillsV3(client, report);
    await ensureSequenceIndexes(client, report);
    // Autonumber counters for every table (fields added by an operator later get one on first use).
    for (const seed of TABLES) {
      for (const f of seed.fields) {
        if (f.type === "autonumber") {
          const t = await client.query("SELECT 1 FROM boss_sections WHERE slug = $1", [seed.slug]);
          if (t.rowCount) await counterFor(client, seed.slug, f.key, f.options?.start ?? 1);
        }
      }
    }
    if (opts.freshSeed) await once(client, "v1:fresh-seed-extras", async () => { await freshExtras(client); return "sample capabilities, inventory and voucher details"; }, report);
    await client.query("COMMIT");
    return report;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
