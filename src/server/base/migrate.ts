import type { Pool, PoolClient } from "pg";
import { FEMA_VOUCHERS } from "@/data/femaVouchers";
import { assignees } from "@/data/actions";
import { ACTION_EXPORT } from "@/data/actionsExport";
import { defaultFormConfig } from "@/lib/base/viewDefaults";
import { ACTION_PREVIOUS_KEYS, TABLES, VOUCHER_DOCUMENT_KEYS, VOUCHER_FEMA_ORDER, VOUCHER_LEGACY_KEYS, VOUCHER_START, seedViewConfig, type TableSeed } from "@/lib/base/definitions";
import type { FieldDef } from "@/lib/base/types";
import { choicesFromNames } from "@/lib/base/fields";

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

/**
 * Forms: the “Category” column is replaced by the “Style” column, which now offers Work and Vouchers.
 * Nothing is deleted from records: a form marked Vouchers in the old column keeps that choice as its Style.
 */
async function backfillsV4(client: PoolClient, report: MigrationReport) {
  const hasForms = (await client.query("SELECT 1 FROM boss_sections WHERE slug = 'forms'")).rowCount;
  if (!hasForms) return;
  await once(
    client,
    "v4:forms-style-work-vouchers",
    async () => {
      // 1. Style offers Work and Vouchers (the choices of an existing field are only extended, never replaced).
      const style = await client.query<{ options: { choices?: Array<{ id: string; name: string; color: string }>; defaultValue?: string } }>("SELECT options FROM boss_fields WHERE table_slug = 'forms' AND key = 'style'");
      if (style.rowCount) {
        const options = style.rows[0].options;
        const choices = options.choices ?? [];
        if (!choices.some((c) => c.name === "Work")) choices.push({ id: "ch_work", name: "Work", color: "green" });
        if (!choices.some((c) => c.name === "Vouchers")) choices.push({ id: "ch_vouchers", name: "Vouchers", color: "orange" });
        await client.query("UPDATE boss_fields SET options = $1::jsonb, updated_at = NOW() WHERE table_slug = 'forms' AND key = 'style'", [JSON.stringify({ ...options, choices, defaultValue: options.defaultValue ?? "Work" })]);
      }
      // 2. A form that was marked Vouchers in the old Category column keeps it as its Style.
      const moved = await client.query(`UPDATE boss_records SET data = data || '{"style":"Vouchers"}'::jsonb, updated_at = NOW() WHERE section_slug = 'forms' AND data->>'category' = 'Vouchers'`);
      // 3. Forms without a style are Work forms.
      const blank = await client.query(`UPDATE boss_records SET data = data || '{"style":"Work"}'::jsonb, updated_at = NOW() WHERE section_slug = 'forms' AND COALESCE(data->>'style', '') = ''`);
      // 4. The Category field goes; views that used it (grouping, filters) now use Style.
      const gone = await client.query("DELETE FROM boss_fields WHERE table_slug = 'forms' AND key = 'category'");
      const views = await client.query<{ id: string; config: Record<string, unknown> }>("SELECT id, config FROM boss_views WHERE table_slug = 'forms'");
      let rewritten = 0;
      for (const v of views.rows) {
        const text = JSON.stringify(v.config);
        const next = text.replace(/("field":)"category"/g, '$1"style"');
        if (next !== text) {
          await client.query("UPDATE boss_views SET config = $2::jsonb, updated_at = NOW() WHERE id = $1", [v.id, next]);
          rewritten += 1;
        }
      }
      return `${moved.rowCount} forms moved to style Vouchers, ${blank.rowCount} blank styles set to Work, ${gone.rowCount} Category field removed, ${rewritten} views now use Style`;
    },
    report,
  );
}

/** Align the Vouchers table with FEMA_Vouchers.xlsx: headers, Form/Status choices, and the 16 rows. */
async function backfillsV5(client: PoolClient, report: MigrationReport) {
  const has = (await client.query("SELECT 1 FROM boss_sections WHERE slug = 'vouchers'")).rowCount;
  if (!has) return;

  await once(
    client,
    "v5:fema-vouchers-table",
    async () => {
      const renames: Array<[string, string]> = [
        ["voucherNo", "Voucher"],
        ["accrualDate", "Accrue"],
        ["docType", "Form"],
        ["headline", "Form Title"],
        ["docStatus", "Status"],
        ["vendorCode", "Issued"],
        ["contractNo", "Reference 1"],
        ["operatorCode", "Perform"],
        ["deliverVia", "Via"],
        ["tracking", "Tracking #"],
        ["i", "ID"],
        ["voucherNote", "Notes"],
        ["ref", "Legacy ID"],
      ];
      for (const [key, name] of renames) {
        await client.query(
          "UPDATE boss_fields SET name = $2, updated_at = NOW() WHERE table_slug = 'vouchers' AND key = $1 AND name IS DISTINCT FROM $2",
          [key, name],
        );
      }

      // Field positions follow the FEMA sheet (plus extras after).
      const seed = TABLES.find((t) => t.slug === "vouchers");
      if (seed) {
        for (const [i, f] of seed.fields.entries()) {
          await client.query("UPDATE boss_fields SET position = $2, updated_at = NOW() WHERE table_slug = 'vouchers' AND key = $1", [f.key, i]);
        }
      }

      const extendChoices = async (key: string, names: string[], colors: Parameters<typeof choicesFromNames>[1]) => {
        const row = await client.query<{ options: { choices?: Array<{ id: string; name: string; color: string }>; defaultValue?: string } }>(
          "SELECT options FROM boss_fields WHERE table_slug = 'vouchers' AND key = $1",
          [key],
        );
        if (!row.rowCount) return;
        const options = row.rows[0].options ?? {};
        const choices = [...(options.choices ?? [])];
        const wanted = choicesFromNames(names, colors);
        for (const c of wanted) {
          if (!choices.some((x) => x.name === c.name)) choices.push(c);
        }
        await client.query("UPDATE boss_fields SET options = $1::jsonb, updated_at = NOW() WHERE table_slug = 'vouchers' AND key = $2", [
          JSON.stringify({ ...options, choices }),
          key,
        ]);
      };
      await extendChoices("docType", ["FD", "FT", "BL", "FQ", "IN"], ["blue", "cyan", "orange", "yellow", "purple"]);
      await extendChoices("docStatus", ["Issued", "Planned", "BOOKED"], ["gray", "yellow", "green"]);

      const group = await client.query<{ group_id: string }>(
        "SELECT group_id FROM boss_groups WHERE section_slug = 'vouchers' ORDER BY position ASC LIMIT 1",
      );
      const groupId = group.rows[0]?.group_id ?? "active";
      if (!group.rowCount) {
        await client.query(
          `INSERT INTO boss_groups (section_slug, group_id, label, display_count, position)
           VALUES ('vouchers', $1, 'ACTIVE VOUCHERS', $2, 0)
           ON CONFLICT (section_slug, group_id) DO UPDATE SET label = EXCLUDED.label, display_count = EXCLUDED.display_count`,
          [groupId, FEMA_VOUCHERS.length],
        );
      } else {
        await client.query(
          "UPDATE boss_groups SET label = COALESCE(label, 'ACTIVE VOUCHERS'), display_count = $2 WHERE section_slug = 'vouchers' AND group_id = $1",
          [groupId, FEMA_VOUCHERS.length],
        );
      }

      let upserted = 0;
      for (const [pos, row] of FEMA_VOUCHERS.entries()) {
        const data = {
          id: row.id,
          i: row.i,
          accrualDate: row.accrualDate,
          docType: row.docType,
          headline: row.headline,
          docStatus: row.docStatus,
          by: row.by,
          vendorCode: row.vendorCode,
          contractNo: row.contractNo,
          operatorCode: row.operatorCode,
          reference2: row.reference2,
          deliverVia: row.deliverVia,
          resource: row.resource,
          tracking: row.tracking,
          vsf: row.vsf,
          manifest: row.manifest,
          voucherNote: row.voucherNote,
          voucherId: `LLG-${row.docType}-${row.i + 4000}`,
        };
        await client.query(
          `INSERT INTO boss_records (section_slug, record_id, group_id, position, data)
           VALUES ('vouchers', $1, $2, $3, $4::jsonb)
           ON CONFLICT (section_slug, record_id) DO UPDATE SET
             group_id = EXCLUDED.group_id,
             position = EXCLUDED.position,
             data = boss_records.data || EXCLUDED.data,
             updated_at = NOW()`,
          [row.id, groupId, pos, JSON.stringify(data)],
        );
        upserted += 1;
      }

      const maxI = Math.max(...FEMA_VOUCHERS.map((r) => r.i));
      await client.query(
        `INSERT INTO boss_counters (table_slug, key, next_value) VALUES ('vouchers', 'i', $1)
         ON CONFLICT (table_slug, key) DO UPDATE SET next_value = GREATEST(boss_counters.next_value, EXCLUDED.next_value)`,
        [maxI + 1],
      );

      await client.query(
        `UPDATE boss_sections SET range_from = 1, range_to = $1, range_total = $1, updated_at = NOW() WHERE slug = 'vouchers'`,
        [FEMA_VOUCHERS.length],
      );

      const simplified = TABLES.find((t) => t.slug === "vouchers")?.views.find((v) => v.key === "simplified");
      if (simplified?.config) {
        const config = seedViewConfig(simplified);
        await client.query(
          `UPDATE boss_views SET
             config = jsonb_set(
               jsonb_set(
                 jsonb_set(config, '{order}', $2::jsonb),
                 '{hidden}', $3::jsonb
               ),
               '{widths}', $4::jsonb
             ),
             updated_at = NOW()
           WHERE table_slug = 'vouchers' AND (id = $1::text OR config->>'key' = 'simplified')`,
          [
            "view_vouchers_simplified",
            JSON.stringify(config.order ?? [...VOUCHER_FEMA_ORDER]),
            JSON.stringify(config.hidden ?? [...VOUCHER_DOCUMENT_KEYS, ...VOUCHER_LEGACY_KEYS]),
            JSON.stringify(config.widths ?? {}),
          ],
        );
      }

      return `renamed FEMA columns; extended Form/Status; upserted ${upserted} vouchers; counter ≥ ${maxI + 1}`;
    },
    report,
  );
}

/** The 16 demo actions the project shipped with before the real Actions export. Used only to recognise untouched ones. */
const LEGACY_DEMO_ACTIONS: Array<[string, string, string, string, string, string, string, boolean, boolean]> = [
  ["A-4642", "2026-07-06", "Review S14 Telemetry Reports", "Tasking", "Ongoing", "FL-1002", "26.28", true, true],
  ["A-4643", "2026-07-06", "Update Onboarding Guidelines", "Training", "Queue", "FL-1004", "26.28", false, false],
  ["A-4645", "2026-07-07", "Draft QA Deployment Notice", "Notice", "Scheduled", "FL-1005", "26.29", true, false],
  ["A-4650", "2026-07-07", "API Compliance Test Run", "Tasking", "Ongoing", "FL-1012", "26.29", true, true],
  ["A-4652", "2026-07-08", "Database Indexing Protocols", "Tasking", "Queue", "FL-1001", "26.30", false, false],
  ["A-4658", "2026-07-09", "Deploy Security Patch v2.1", "Notice", "Ongoing", "FL-1002", "26.30", true, true],
  ["A-4663", "2026-07-10", "Prepare Sprint Review Deck", "Training", "Scheduled", "FL-1004", "26.31", true, false],
  ["A-4665", "2026-07-10", "Validate Sourcing Schema", "Tasking", "Queue", "FL-1008", "26.31", false, false],
  ["A-4672", "2026-07-11", "Sync with Vendor Core API", "Tasking", "Ongoing", "FL-1020", "26.32", true, true],
  ["A-4675", "2026-07-12", "Internal Training: Rust Core", "Training", "Scheduled", "FL-1011", "26.32", false, false],
  ["A-4681", "2026-07-13", "Refactor Legacy Auth Modules", "Tasking", "Queue", "FL-1005", "26.33", false, false],
  ["A-4688", "2026-07-14", "Audit Log Processing Flow", "Notice", "Ongoing", "FL-1001", "26.33", true, true],
  ["A-4690", "2026-07-15", "Optimize Image Generation Assets", "Tasking", "Scheduled", "FL-1014", "26.34", true, false],
  ["A-4693", "2026-07-16", "Deploy Hotfix - User Sessions", "Notice", "Ongoing", "FL-1002", "26.34", true, true],
  ["A-4698", "2026-07-17", "Review SML Custom Templates", "Training", "Queue", "FL-1004", "26.35", false, false],
  ["A-4701", "2026-07-18", "Setup Telemetry Edge Cache", "Tasking", "Scheduled", "FL-1012", "26.35", true, false],
];

/**
 * Actions follow the Airtable export (Actions-OPEN ACTIONS - HOT QA NEXT.csv): Code, Wk, Accrue, Status, Task Title, Type, Folio,
 * Asn, QA, Sort, and its 158 actions in its order. For a database that already has actions:
 *  - fields are renamed / reordered / given the export's choices, never deleted (Act stays, hidden);
 *  - a demo action that is still exactly as the project shipped it is replaced by the export's values, or removed when
 *    the export does not have it;
 *  - any other action with a code in the export (one a person edited or created) only has its blank cells filled;
 *  - actions that are not in the export are kept, after the export's rows. Nothing a person typed is overwritten.
 */
async function backfillsV7(client: PoolClient, report: MigrationReport) {
  const has = (await client.query("SELECT 1 FROM boss_sections WHERE slug = 'actions'")).rowCount;
  if (!has) return;
  const seed = TABLES.find((t) => t.slug === "actions")!;
  await once(
    client,
    "v7:actions-export",
    async () => {
      // 1. fields
      type Opts = { choices?: Array<{ id: string; name: string; color: string }>; [k: string]: unknown };
      for (const [i, f] of seed.fields.entries()) {
        const cur = await client.query<{ options: Opts }>("SELECT options FROM boss_fields WHERE table_slug = 'actions' AND key = $1", [f.key]);
        if (!cur.rowCount) continue;
        const options: Opts = { ...(cur.rows[0].options ?? {}) };
        const want = (f.options ?? {}) as Opts;
        if (want.choices) {
          const have = options.choices ?? [];
          for (const c of want.choices) if (!have.some((h) => h.name === c.name)) have.push(c);
          options.choices = have;
        }
        if (want.help !== undefined) options.help = want.help;
        if (want.placeholder !== undefined) options.placeholder = want.placeholder;
        await client.query("UPDATE boss_fields SET name = $2, position = $3, options = $4::jsonb, required = $5, updated_at = NOW() WHERE table_slug = 'actions' AND key = $1", [f.key, f.name, i, JSON.stringify(options), f.key === "code"]);
      }
      await client.query("UPDATE boss_fields SET position = 100 + position, updated_at = NOW() WHERE table_slug = 'actions' AND key = ANY($1::text[]) AND position < 100", [ACTION_PREVIOUS_KEYS]);

      // 2. who the Asn codes are
      const contacts = await client.query<{ record_id: string; c: string }>("SELECT record_id, lower(btrim(data->>'contact')) AS c FROM boss_records WHERE section_slug = 'profiles'");
      const byContact = new Map<string, string | null>();
      for (const r of contacts.rows) byContact.set(r.c, byContact.has(r.c) ? null : r.record_id); // two profiles with one code: ambiguous, keep the text
      const lookup = (c: string) => byContact.get(c.trim().toLowerCase()) ?? undefined;

      // 3. rows
      const group = await client.query<{ group_id: string }>("SELECT group_id FROM boss_groups WHERE section_slug = 'actions' ORDER BY position LIMIT 1");
      let groupId = group.rows[0]?.group_id;
      if (!groupId) {
        await client.query("INSERT INTO boss_groups (section_slug, group_id, label, position) VALUES ('actions', 'all', NULL, 0)");
        groupId = "all";
      }
      const existing = await client.query<{ record_id: string; data: Record<string, unknown> }>("SELECT record_id, data FROM boss_records WHERE section_slug = 'actions'");
      const byCode = new Map(existing.rows.map((r) => [String(r.data.code ?? ""), r]));
      const demo = new Map(LEGACY_DEMO_ACTIONS.map((d) => [d[0], d]));
      const untouchedDemo = (data: Record<string, unknown>) => {
        const d = demo.get(String(data.code ?? ""));
        if (!d) return false;
        const same = d[0] === data.code && d[1] === data.accrue && d[2] === data.title && d[3] === data.type && d[4] === data.status && d[5] === data.folio && d[6] === data.wk && d[7] === data.act && d[8] === data.qa;
        const known = new Set(["id", "code", "accrue", "title", "type", "status", "folio", "wk", "act", "qa"]);
        return same && Object.keys(data).every((k) => known.has(k));
      };
      const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

      let inserted = 0, replaced = 0, filled = 0, kept = 0;
      const inExport = new Set<string>();
      for (const [n, a] of ACTION_EXPORT.entries()) {
        inExport.add(a.code);
        const rec: Record<string, unknown> = {
          code: a.code, wk: a.wk, accrue: a.accrue || null, status: a.status || null, title: a.title, type: a.type || null, folio: a.folio,
          ...assignees(a.asn, lookup), qa: false, sort: a.sort,
        };
        const found = byCode.get(a.code);
        if (!found) {
          await client.query("INSERT INTO boss_records (section_slug, record_id, group_id, position, data) VALUES ('actions', $1, $2, $3, $4::jsonb) ON CONFLICT DO NOTHING", [a.id, groupId, n, JSON.stringify({ id: a.id, ...rec })]);
          inserted += 1;
          continue;
        }
        let patch: Record<string, unknown>;
        if (untouchedDemo(found.data)) {
          patch = { ...rec };
          replaced += 1;
        } else {
          patch = {};
          for (const [k, v] of Object.entries(rec)) {
            if (k === "asnCode") continue;
            if (k === "asn") {
              if (blank(found.data.asn) && blank(found.data.asnCode) && !blank(v)) patch.asn = v;
              if (blank(found.data.asn) && blank(found.data.asnCode) && rec.asnCode) patch.asnCode = rec.asnCode;
              continue;
            }
            if (k === "qa") continue;
            if (blank(found.data[k]) && !blank(v)) patch[k] = v;
          }
          if (Object.keys(patch).length) filled += 1; else kept += 1;
        }
        await client.query("UPDATE boss_records SET data = data || $2::jsonb, position = $3, updated_at = NOW() WHERE section_slug = 'actions' AND record_id = $1", [found.record_id, JSON.stringify(patch), n]);
      }
      // demo actions the export does not have are removed (only when still untouched); everything else follows the export
      let removed = 0;
      for (const r of existing.rows) {
        const code = String(r.data.code ?? "");
        if (inExport.has(code)) continue;
        if (untouchedDemo(r.data)) {
          await client.query("DELETE FROM boss_records WHERE section_slug = 'actions' AND record_id = $1", [r.record_id]);
          removed += 1;
        }
      }
      await client.query("UPDATE boss_records SET position = position + 100000 WHERE section_slug = 'actions' AND NOT (data->>'code' = ANY($1::text[]))", [ACTION_EXPORT.map((a) => a.code)]);

      // 4. the main view keeps the table's own order and hides the previous fields
      const views = await client.query<{ id: string; config: { sort?: Array<{ field: string; dir: string }>; hidden?: string[]; key?: string } }>("SELECT id, config FROM boss_views WHERE table_slug = 'actions'");
      // only fields of the earlier layout that this database really has are hidden (a fresh database has none)
      const present = (await client.query<{ key: string }>("SELECT key FROM boss_fields WHERE table_slug = 'actions' AND key = ANY($1::text[])", [ACTION_PREVIOUS_KEYS])).rows.map((r) => r.key);
      for (const v of views.rows) {
        const hidden = [...new Set([...(v.config.hidden ?? []), ...present])];
        let config = { ...v.config, hidden };
        const sort = v.config.sort ?? [];
        if (v.config.key === "all" && sort.length === 1 && sort[0].field === "accrue" && sort[0].dir === "asc") config = { ...config, sort: [] };
        await client.query("UPDATE boss_views SET config = $2::jsonb, updated_at = NOW() WHERE id = $1", [v.id, JSON.stringify(config)]);
      }
      const total = (await client.query<{ n: string }>("SELECT COUNT(*) AS n FROM boss_records WHERE section_slug = 'actions'")).rows[0].n;
      await client.query("UPDATE boss_sections SET range_from = 1, range_to = $1, range_total = $1, updated_at = NOW() WHERE slug = 'actions'", [Number(total)]);
      return `${inserted} actions added, ${replaced} demo actions replaced, ${removed} demo actions not in the export removed, ${filled} edited actions had blank cells filled, ${kept} already complete`;
    },
    report,
  );
}

/**
 * Vouchers follow the full Airtable export (Vouchers-VOUCHERS - Simplified.csv):
 *  - VSF becomes a link field (it holds the voucher's record link) and Scans an attachment field;
 *  - Notes get their full text, Manifest the CSV's wording ("Unnamed record"), VSF its link.
 * Careful with existing data: a cell is only replaced when it is blank or still holds the value the earlier seed wrote
 * (the first line of the note, "Unnamed manifest", the placeholder "VSF"). Anything a person typed is kept. Nothing is deleted:
 * an old numeric Scans value moves to `scansCount` inside the record.
 */
async function backfillsV6(client: PoolClient, report: MigrationReport) {
  const has = (await client.query("SELECT 1 FROM boss_sections WHERE slug = 'vouchers'")).rowCount;
  if (!has) return;
  await once(
    client,
    "v6:vouchers-csv-update",
    async () => {
      // 1. field types
      const vsf = await client.query<{ type: string }>("SELECT type FROM boss_fields WHERE table_slug = 'vouchers' AND key = 'vsf'");
      let typed = 0;
      if (vsf.rows[0]?.type === "singleSelect") {
        await client.query(`UPDATE boss_fields SET type = 'url', options = $1::jsonb, updated_at = NOW() WHERE table_slug = 'vouchers' AND key = 'vsf'`, [JSON.stringify({ placeholder: "https://…", help: "Link to the voucher's record." })]);
        typed += 1;
      }
      const scans = await client.query<{ type: string }>("SELECT type FROM boss_fields WHERE table_slug = 'vouchers' AND key = 'scans'");
      if (scans.rows[0]?.type === "number") {
        await client.query(`UPDATE boss_fields SET type = 'attachment', options = $1::jsonb, updated_at = NOW() WHERE table_slug = 'vouchers' AND key = 'scans'`, [JSON.stringify({ help: "Scanned documents for this voucher." })]);
        typed += 1;
      }
      // an old numeric Scans value is kept under another key, then the cell is free for files
      const moved = await client.query(
        `UPDATE boss_records SET data = (data - 'scans') || jsonb_build_object('scansCount', data->'scans'), updated_at = NOW()
         WHERE section_slug = 'vouchers' AND jsonb_typeof(data->'scans') = 'number'`,
      );

      // 2. cell values from the export
      const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
      let notes = 0, links = 0, manifests = 0, refs = 0;
      for (const row of FEMA_VOUCHERS) {
        const found = await client.query<{ record_id: string; data: Record<string, unknown> }>("SELECT record_id, data FROM boss_records WHERE section_slug = 'vouchers' AND data->>'i' = $1 LIMIT 1", [String(row.i)]);
        if (!found.rowCount) continue; // a voucher someone deleted is not brought back
        const { record_id: id, data } = found.rows[0];
        const patch: Record<string, unknown> = {};
        const note = typeof data.voucherNote === "string" ? data.voucherNote.trim() : "";
        if (row.voucherNote && (blank(note) || note === row.voucherNote.split("\n")[0].trim()) && data.voucherNote !== row.voucherNote) {
          patch.voucherNote = row.voucherNote;
          notes += 1;
        }
        if (row.vsf && (blank(data.vsf) || data.vsf === "VSF")) {
          patch.vsf = row.vsf;
          links += 1;
        }
        if (typeof data.manifest === "string" && /(^|\n)Unnamed manifest(\n|$)/.test(data.manifest)) {
          patch.manifest = data.manifest.replace(/(^|\n)Unnamed manifest(?=\n|$)/g, "$1Unnamed record");
          manifests += 1;
        }
        if (typeof data.reference2 === "string" && data.reference2 !== data.reference2.trim()) {
          patch.reference2 = data.reference2.trim();
          refs += 1;
        }
        if (Object.keys(patch).length) await client.query("UPDATE boss_records SET data = data || $2::jsonb, updated_at = NOW() WHERE section_slug = 'vouchers' AND record_id = $1", [id, JSON.stringify(patch)]);
      }
      return `${typed} field types changed; ${moved.rowCount} old Scans counts kept as scansCount; ${notes} notes completed, ${links} VSF links set, ${manifests} manifests re-worded, ${refs} references trimmed`;
    },
    report,
  );
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
    // Form views (the view type) have a category of their own; give existing ones the default.
    await once(
      client,
      "v2:forms-category-work",
      async () => {
        const v = await client.query(
          `UPDATE boss_views SET config = jsonb_set(config, '{form,category}', '"Work"'::jsonb), updated_at = NOW()
           WHERE type = 'form' AND config ? 'form' AND NOT (config->'form' ? 'category')`,
        );
        return `${v.rowCount} form views set to category Work`;
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

  // Printed-document extras for the first FEMA sample voucher (LLG-FD-15574). Sheet columns come from seed / v5.
  const terms = "Carrier accepts full responsibility for claim, loss, or damage occurring during transport. All applicable DOT regulations must be observed throughout the duration of haul. Hours of Service limitations must be communicated to shipper prior to or at time of dispatch. Failure to deliver the listed quantity, weight, or configuration may result in rate adjustment or claim deduction. Signed Proof of Delivery is required for freight payment.";
  await merge("vouchers", "v1", {
    vendorAccount: "Federal Emergency Management Agency\n500 C Street SW\nWashington, DC 20472",
    operatedBy: "FEMA DC Greencastle\n12316 Molly Pitcher Hwy\nGreencastle, PA 17225\n(301) 874-4200",
    deliverPhone: "(609) 807-9228",
    deliverPhone2: "800-456-7296",
    terms,
    manifestLines: "I/T-015 | I/T-015 · GREENCASTLE · Wipes | Diaper Baby Wipe Fragrance Free | 7/13/2026 | 10859120630",
    packLines: "I/T-015 | 80 Wipes/Bag | 1 Pallet · 220 lbs · 40x48x55 | 24 | 1440 | FEMA DC GREENCASTLE / 12316 Molly Pitcher Highway / Greencastle, PA 17225",
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
    await backfillsV4(client, report);
    await backfillsV5(client, report);
    await backfillsV6(client, report);
    await backfillsV7(client, report);
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
