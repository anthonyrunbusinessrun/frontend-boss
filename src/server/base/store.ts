import type { Pool, PoolClient } from "pg";
import { displayText, linkIds } from "@/lib/base/compute";
import { normalizeFieldOptions, normalizeViewConfig, isFieldType } from "@/lib/base/config";
import { TABLE_SLUGS, tableSeed } from "@/lib/base/definitions";
import { FIELD_TYPE_INFO, newFieldKey, newId, primaryField, readAttachments } from "@/lib/base/fields";
import { applyNodes, buildTree, treeToNodes, uniqueName, type LayoutNode } from "@/lib/base/layout";
import { isBlank } from "@/lib/base/query";
import { formatCode, isValidPrefix, nextFromMax } from "@/lib/base/sequence";
import { buildRecordQuery, UnsupportedFilterError, type RecordQuery } from "./recordQuery";
import { validateRecordInput, type FieldErrors } from "@/lib/base/validate";
import { defaultConfigFor, pruneConfig } from "@/lib/base/viewDefaults";
import { VIEW_TYPES, type FavoriteDef, type FieldDef, type FieldOptions, type FieldType, type LinkedTable, type RecordRow, type SectionDef, type TableBundle, type ViewAccess, type ViewConfig, type ViewDef, type ViewType } from "@/lib/base/types";

/** No `server-only` import so the store can be exercised by integration tests; only the Next route imports it. */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type Db = Pool | PoolClient;

const LINK_SUB: Record<string, string> = { profiles: "position", categories: "levelTwo" };
const MAX_RECORDS_PER_TABLE = 50_000;

/* --------------------------------------------------------------------- helpers */

export function assertTable(slug: string): { slug: string; name: string } {
  const seed = tableSeed(slug);
  if (!seed) throw new ApiError(404, "Unknown table");
  return { slug, name: seed.name };
}

interface FieldRow {
  key: string;
  name: string;
  type: FieldType;
  options: FieldOptions;
  position: number;
  required: boolean;
  is_primary: boolean;
}

const toField = (r: FieldRow): FieldDef => ({ key: r.key, name: r.name, type: r.type, options: r.options ?? {}, position: r.position, required: r.required, primary: r.is_primary });

export async function loadFields(db: Db, slug: string): Promise<FieldDef[]> {
  const res = await db.query<FieldRow>("SELECT key, name, type, options, position, required, is_primary FROM boss_fields WHERE table_slug = $1 ORDER BY position, name", [slug]);
  return res.rows.map(toField);
}

interface ViewRow {
  id: string;
  table_slug: string;
  name: string;
  type: ViewType;
  config: ViewConfig;
  access: ViewAccess;
  owner_id: string | null;
  section_id: string | null;
  position: number;
}

const toView = (r: ViewRow): ViewDef => ({ id: r.id, table: r.table_slug, name: r.name, type: r.type, config: r.config, access: r.access, ownerId: r.owner_id, sectionId: r.section_id, position: r.position });
const VIEW_COLUMNS = "id, table_slug, name, type, config, access, owner_id, section_id, position";

const toSection = (r: { id: string; table_slug: string; name: string; position: number }): SectionDef => ({ id: r.id, table: r.table_slug, name: r.name, position: r.position });

function mergeDefined<T extends object>(base: T, over: Partial<T>): T {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

function cleanName(raw: unknown, what: string, max = 100): string {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!name) throw new ApiError(422, `${what} name is required.`);
  if (name.length > max) throw new ApiError(422, `${what} name must be ${max} characters or fewer.`);
  return name;
}

async function tx<T>(pool: Pool, slug: string, run: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // One writer per table at a time keeps unique checks and autonumbers race-free.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`boss-table:${slug}`]);
    const out = await run(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/* ---------------------------------------------------------------------- bundle */

async function buildLinked(db: Db, fields: FieldDef[]): Promise<Record<string, LinkedTable>> {
  const wanted = new Map<string, Set<string>>();
  const want = (table: string, key?: string) => {
    if (!TABLE_SLUGS.includes(table)) return;
    const set = wanted.get(table) ?? new Set<string>();
    if (key) set.add(key);
    wanted.set(table, set);
  };
  for (const f of fields) {
    if (f.type === "link" && f.options.linkTable) want(f.options.linkTable, f.options.linkFilter?.key);
    if (f.type === "computed" && f.options.computed?.fn === "linkedFrom") want(f.options.computed.table, f.options.computed.key);
  }
  const out: Record<string, LinkedTable> = {};
  for (const [table, keys] of wanted) {
    const tfields = await loadFields(db, table);
    const primary = primaryField(tfields);
    if (!primary) continue;
    const photo = tfields.find((f) => f.type === "attachment" && f.key === "photo") ?? undefined;
    const subKey = LINK_SUB[table];
    const name = tableSeed(table)?.name ?? table;
    const res = await db.query<{ data: RecordRow }>(
      `SELECT r.data FROM boss_records r JOIN boss_groups g ON g.section_slug = r.section_slug AND g.group_id = r.group_id
       WHERE r.section_slug = $1 ORDER BY g.position, r.position, r.record_id`,
      [table],
    );
    out[table] = {
      slug: table,
      name,
      primaryKey: primary.key,
      records: res.rows.map(({ data }) => {
        const filter: Record<string, unknown> = { inactive: data.inactive };
        for (const k of keys) filter[k] = data[k];
        return {
          id: data.id,
          label: displayText(primary, data) || data.id,
          ...(photo ? { photo: readAttachments(data[photo.key])[0]?.url } : {}),
          ...(subKey && typeof data[subKey] === "string" ? { sub: data[subKey] as string } : {}),
          filter,
        };
      }),
    };
  }
  return out;
}

/** Above this many records a table is filtered, searched and sorted by the server instead of the browser. */
export const serverQueryThreshold = () => {
  const n = Number(process.env.BOSS_SERVER_QUERY_THRESHOLD ?? 3000);
  return Number.isFinite(n) && n >= 0 ? n : 3000;
};
export const serverPage = () => {
  const n = Number(process.env.BOSS_SERVER_PAGE ?? 200);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 200;
};

export async function getBundle(pool: Pool, slug: string, userId: string | null): Promise<TableBundle> {
  const table = assertTable(slug);
  const fields = await loadFields(pool, slug);
  const count = Number((await pool.query<{ n: string }>("SELECT COUNT(*) AS n FROM boss_records WHERE section_slug = $1", [slug])).rows[0].n);
  const serverMode = count > serverQueryThreshold();
  const [records, views, sections, favorites] = await Promise.all([
    pool.query<{ data: RecordRow }>(
      `SELECT r.data FROM boss_records r JOIN boss_groups g ON g.section_slug = r.section_slug AND g.group_id = r.group_id
       WHERE r.section_slug = $1 ORDER BY g.position, r.position, r.record_id ${serverMode ? `LIMIT ${serverPage()}` : ""}`,
      [slug],
    ),
    pool.query<ViewRow>(`SELECT ${VIEW_COLUMNS} FROM boss_views WHERE table_slug = $1 AND (access <> 'personal' OR owner_id = $2) ORDER BY position, created_at, id`, [slug, userId]),
    pool.query<{ id: string; table_slug: string; name: string; position: number }>("SELECT id, table_slug, name, position FROM boss_nav_sections WHERE table_slug = $1 ORDER BY position, created_at, id", [slug]),
    userId
      ? pool.query<{ kind: "view" | "record"; ref_id: string; position: number }>("SELECT kind, ref_id, position FROM boss_favorites WHERE owner_id = $1 AND table_slug = $2 ORDER BY position, created_at", [userId, slug])
      : Promise.resolve({ rows: [] as Array<{ kind: "view" | "record"; ref_id: string; position: number }> }),
  ]);
  const recordRows = records.rows.map((r) => r.data);
  const recordIds = new Set(recordRows.map((r) => r.id));
  const viewRows = views.rows.map(toView);
  const viewIds = new Set(viewRows.map((v) => v.id));
  return {
    table,
    recordCount: count,
    serverMode,
    serverPage: serverPage(),
    fields,
    records: recordRows,
    views: viewRows,
    sections: sections.rows.map(toSection),
    // A favorite whose target was deleted is simply not offered.
    favorites: favorites.rows.filter((f) => (f.kind === "view" ? viewIds.has(f.ref_id) : recordIds.has(f.ref_id))).map((f): FavoriteDef => ({ kind: f.kind, refId: f.ref_id, position: f.position })),
    linked: await buildLinked(pool, fields),
    userId,
  };
}

/* --------------------------------------------------------------------- records */

function fieldErrors(errors: FieldErrors): never {
  throw new ApiError(422, "Some fields need attention.", { fieldErrors: errors });
}

/** Uniqueness and link integrity: the checks that need the database. */
async function checkRelations(db: Db, slug: string, fields: FieldDef[], values: Record<string, unknown>, existing: RecordRow | null): Promise<void> {
  const errors: FieldErrors = {};
  for (const f of fields) {
    if (!(f.key in values)) continue;
    const v = values[f.key];
    if (f.options.unique && !isBlank(v)) {
      const dup = await db.query<{ record_id: string }>(
        `SELECT record_id FROM boss_records WHERE section_slug = $1 AND ($2::text IS NULL OR record_id <> $2) AND lower(btrim(data->>$3)) = lower(btrim($4)) LIMIT 1`,
        [slug, existing?.id ?? null, f.key, String(v)],
      );
      if (dup.rowCount) errors[f.key] = `“${String(v)}” is already used by another record.`;
    }
    if (f.type === "link" && f.options.linkTable) {
      const ids = linkIds(v);
      const before = existing ? linkIds(existing[f.key]) : [];
      for (const id of ids) {
        const target = await db.query<{ data: RecordRow }>("SELECT data FROM boss_records WHERE section_slug = $1 AND record_id = $2", [f.options.linkTable, id]);
        if (!target.rowCount) {
          errors[f.key] = `That ${tableSeed(f.options.linkTable)?.singular ?? "record"} no longer exists.`;
          break;
        }
        const rule = f.options.linkFilter;
        // An existing link stays valid even if the target later stops matching (e.g. someone leaves the team).
        if (rule && !before.includes(id) && target.rows[0].data[rule.key] !== rule.equals) {
          errors[f.key] = `Only ${rule.key === "team" ? "team members" : "matching records"} can be chosen here.`;
          break;
        }
      }
    }
  }
  if (Object.keys(errors).length > 0) fieldErrors(errors);
}

async function nextAutonumber(client: PoolClient, slug: string, f: FieldDef): Promise<number> {
  const start = f.options.start ?? 1;
  const res = await client.query<{ v: string }>(
    `INSERT INTO boss_counters (table_slug, key, next_value) VALUES ($1, $2, $3::bigint + 1)
     ON CONFLICT (table_slug, key) DO UPDATE SET next_value = boss_counters.next_value + 1
     RETURNING next_value - 1 AS v`,
    [slug, f.key, start],
  );
  return Number(res.rows[0].v);
}

/** Highest number in use by a sequence field, found by the database. */
async function highestInUse(db: Db, slug: string, f: FieldDef): Promise<number | null> {
  const seq = f.options.sequence!;
  if (!isValidPrefix(seq.prefix)) throw new ApiError(500, "Invalid code prefix.");
  const res = await db.query<{ m: string | null }>(
    `SELECT MAX(substring(data->>$2 FROM $3::int)::numeric)::text AS m FROM boss_records WHERE section_slug = $1 AND data->>$2 ~ $4`,
    [slug, f.key, seq.prefix.length + 1, `^${seq.prefix}[0-9]+$`],
  );
  return res.rows[0].m === null ? null : Number(res.rows[0].m);
}

/**
 * Hands out the next code. Runs inside the table's write lock, so two people saving at the same moment get different
 * numbers; the counter keeps the highest number ever issued, so a deleted record's code is never reused.
 */
async function issueCode(c: PoolClient, slug: string, f: FieldDef): Promise<string> {
  const seq = f.options.sequence!;
  const counter = await c.query<{ next_value: string }>("SELECT next_value FROM boss_counters WHERE table_slug = $1 AND key = $2 FOR UPDATE", [slug, f.key]);
  const next = nextFromMax(await highestInUse(c, slug, f), counter.rowCount ? Number(counter.rows[0].next_value) : null);
  await c.query(
    `INSERT INTO boss_counters (table_slug, key, next_value) VALUES ($1, $2, $3::bigint + 1)
     ON CONFLICT (table_slug, key) DO UPDATE SET next_value = EXCLUDED.next_value`,
    [slug, f.key, next],
  );
  return formatCode(seq, next);
}

/** The code the next new record would get. Informational: it is not reserved, the server assigns the real one on save. */
export async function peekCode(pool: Pool, slug: string, key: string): Promise<{ value: string }> {
  assertTable(slug);
  const fields = await loadFields(pool, slug);
  const f = fields.find((x) => x.key === key && x.options.sequence);
  if (!f) throw new ApiError(404, "That field does not have automatic codes.");
  const counter = await pool.query<{ next_value: string }>("SELECT next_value FROM boss_counters WHERE table_slug = $1 AND key = $2", [slug, key]);
  const next = nextFromMax(await highestInUse(pool, slug, f), counter.rowCount ? Number(counter.rows[0].next_value) : null);
  return { value: formatCode(f.options.sequence!, next) };
}

export interface CreateRecordOptions {
  /** Server-only integration key; checked under the same table lock as inserts. */
  idempotencyKey?: { field: string; value: string };
  allowedKeys?: ReadonlySet<string>;
  requiredKeys?: ReadonlySet<string>;
}

export async function createRecord(pool: Pool, slug: string, input: Record<string, unknown>, opts: CreateRecordOptions = {}): Promise<RecordRow> {
  assertTable(slug);
  return tx(pool, slug, async (c) => {
    const fields = await loadFields(c, slug);
    if (opts.idempotencyKey) {
      const key = opts.idempotencyKey;
      if (!fields.some(f => f.key === key.field && f.options.unique) || input[key.field] !== key.value)
        throw new ApiError(422, "An integration key must match a unique field.");
      const existing = await c.query<{ data: RecordRow }>("SELECT data FROM boss_records WHERE section_slug=$1 AND data->>$2=$3", [slug, key.field, key.value]);
      if (existing.rows[0]) return existing.rows[0].data;
    }
    // Fields with a default (for example a form's category) use it when the request does not say.
    const withDefaults: Record<string, unknown> = { ...input };
    for (const f of fields) {
      if (f.options.defaultValue !== undefined && !(f.key in withDefaults) && (!opts.allowedKeys || opts.allowedKeys.has(f.key))) withDefaults[f.key] = f.options.defaultValue;
    }
    const { values, errors, ignored } = validateRecordInput(fields, withDefaults, { mode: "create", ...opts });
    if (ignored.length > 0 && !opts.allowedKeys) throw new ApiError(422, `Unknown or read-only fields: ${ignored.join(", ")}.`, { ignored });
    if (Object.keys(errors).length > 0) fieldErrors(errors);
    await checkRelations(c, slug, fields, values, null);
    // Generated codes come from the server only: a code typed or sent by the client is ignored.
    for (const f of fields) if (f.options.sequence) values[f.key] = await issueCode(c, slug, f);

    const count = await c.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM boss_records WHERE section_slug = $1", [slug]);
    if (count.rows[0].n >= MAX_RECORDS_PER_TABLE) throw new ApiError(409, "This table has reached its record limit.");

    for (const f of fields) if (f.type === "autonumber") values[f.key] = await nextAutonumber(c, slug, f);
    // Fields the form did not supply start empty (checkboxes false) so every record has the same shape.
    for (const f of fields) {
      if (f.key in values || f.type === "computed" || f.type === "autonumber") continue;
      values[f.key] = f.type === "checkbox" ? false : f.type === "multiSelect" || f.type === "attachment" ? [] : null;
    }

    // New rows are appended after the last existing one.
    let group = await c.query<{ group_id: string }>("SELECT group_id FROM boss_groups WHERE section_slug = $1 ORDER BY position DESC LIMIT 1", [slug]);
    if (!group.rowCount) {
      await c.query("INSERT INTO boss_groups (section_slug, group_id, label, position) VALUES ($1, 'main', NULL, 0)", [slug]);
      group = { rows: [{ group_id: "main" }], rowCount: 1 } as typeof group;
    }
    const id = newId("rec");
    const data = { ...values, id };
    await c.query(
      `INSERT INTO boss_records (section_slug, record_id, group_id, position, data)
       VALUES ($1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM boss_records WHERE section_slug = $1 AND group_id = $3), 0), $4::jsonb)`,
      [slug, id, group.rows[0].group_id, JSON.stringify(data)],
    );
    return data as RecordRow;
  });
}

export async function updateRecord(pool: Pool, slug: string, id: string, patch: Record<string, unknown>): Promise<RecordRow> {
  assertTable(slug);
  return tx(pool, slug, async (c) => {
    const found = await c.query<{ data: RecordRow }>("SELECT data FROM boss_records WHERE section_slug = $1 AND record_id = $2 FOR UPDATE", [slug, id]);
    if (!found.rowCount) throw new ApiError(404, "Record not found.");
    const existing = found.rows[0].data;
    const fields = await loadFields(c, slug);
    const { values, errors, ignored } = validateRecordInput(fields, patch, { mode: "update" });
    if (ignored.length > 0) throw new ApiError(422, `Unknown or read-only fields: ${ignored.join(", ")}.`, { ignored });
    if (Object.keys(errors).length > 0) fieldErrors(errors);
    // A required field may not be cleared by an update either.
    const cleared: FieldErrors = {};
    for (const f of fields) if (f.required && f.key in values && f.type !== "checkbox" && isBlank(values[f.key])) cleared[f.key] = `${f.name} is required.`;
    if (Object.keys(cleared).length > 0) fieldErrors(cleared);
    await checkRelations(c, slug, fields, values, existing);
    const res = await c.query<{ data: RecordRow }>("UPDATE boss_records SET data = data || $3::jsonb, updated_at = NOW() WHERE section_slug = $1 AND record_id = $2 RETURNING data", [slug, id, JSON.stringify(values)]);
    return res.rows[0].data;
  });
}

/** Delete records and remove links that pointed at them, so no field is left referencing a missing record. */
export async function deleteRecords(pool: Pool, slug: string, ids: string[]): Promise<{ deleted: number; unlinked: number }> {
  assertTable(slug);
  const unique = [...new Set(ids)].slice(0, 500);
  if (unique.length === 0) throw new ApiError(422, "No records selected.");
  return tx(pool, slug, async (c) => {
    const del = await c.query("DELETE FROM boss_records WHERE section_slug = $1 AND record_id = ANY($2::text[])", [slug, unique]);
    await c.query("DELETE FROM boss_favorites WHERE kind = 'record' AND table_slug = $1 AND ref_id = ANY($2::text[])", [slug, unique]);
    let unlinked = 0;
    const links = await c.query<{ table_slug: string; key: string; multiple: boolean }>(
      "SELECT table_slug, key, COALESCE((options->>'multiple')::boolean, false) AS multiple FROM boss_fields WHERE type = 'link' AND options->>'linkTable' = $1",
      [slug],
    );
    for (const l of links.rows) {
      const r = l.multiple
        ? await c.query(
            `UPDATE boss_records SET data = jsonb_set(data, ARRAY[$2], COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(data->$2) e WHERE NOT (e #>> '{}') = ANY($3::text[])), '[]'::jsonb)), updated_at = NOW()
             WHERE section_slug = $1 AND jsonb_typeof(data->$2) = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->$2) e WHERE e = ANY($3::text[]))`,
            [l.table_slug, l.key, unique],
          )
        : await c.query(`UPDATE boss_records SET data = data || jsonb_build_object($2::text, NULL), updated_at = NOW() WHERE section_slug = $1 AND data->>$2 = ANY($3::text[])`, [l.table_slug, l.key, unique]);
      unlinked += r.rowCount ?? 0;
    }
    return { deleted: del.rowCount ?? 0, unlinked };
  });
}

/* ---------------------------------------------------------------------- fields */

async function assertFieldName(db: Db, slug: string, name: string, exceptKey?: string) {
  const dup = await db.query("SELECT 1 FROM boss_fields WHERE table_slug = $1 AND lower(name) = lower($2) AND key <> COALESCE($3, '')", [slug, name, exceptKey ?? null]);
  if (dup.rowCount) throw new ApiError(422, `A field named “${name}” already exists.`, { fieldErrors: { name: "That name is already used by another field." } });
}

export async function createField(pool: Pool, slug: string, input: { name?: unknown; type?: unknown; options?: unknown; required?: unknown }): Promise<FieldDef> {
  assertTable(slug);
  const name = cleanName(input.name, "Field");
  if (!isFieldType(input.type) || !FIELD_TYPE_INFO.find((t) => t.type === input.type)?.creatable) throw new ApiError(422, "Choose a field type.");
  const type = input.type;
  return tx(pool, slug, async (c) => {
    await assertFieldName(c, slug, name);
    const options = normalizeFieldOptions(type, input.options);
    if (type === "link") {
      if (!options.linkTable || !TABLE_SLUGS.includes(options.linkTable)) throw new ApiError(422, "Choose a table to link to.");
    }
    const key = newFieldKey();
    const pos = await c.query<{ p: number }>("SELECT COALESCE(MAX(position) + 1, 0)::int AS p FROM boss_fields WHERE table_slug = $1", [slug]);
    const res = await c.query<FieldRow>(
      `INSERT INTO boss_fields (table_slug, key, name, type, options, position, required, is_primary) VALUES ($1, $2, $3, $4, $5::jsonb, $6, FALSE, FALSE)
       RETURNING key, name, type, options, position, required, is_primary`,
      [slug, key, name, type, JSON.stringify(options), pos.rows[0].p],
    );
    return toField(res.rows[0]);
  });
}

export async function updateField(pool: Pool, slug: string, key: string, patch: { name?: unknown; options?: unknown; required?: unknown }): Promise<FieldDef> {
  assertTable(slug);
  return tx(pool, slug, async (c) => {
    const cur = await c.query<FieldRow>("SELECT key, name, type, options, position, required, is_primary FROM boss_fields WHERE table_slug = $1 AND key = $2 FOR UPDATE", [slug, key]);
    if (!cur.rowCount) throw new ApiError(404, "Field not found.");
    const field = toField(cur.rows[0]);
    const name = patch.name === undefined ? field.name : cleanName(patch.name, "Field");
    if (name !== field.name) await assertFieldName(c, slug, name, key);
    const options = patch.options === undefined ? field.options : normalizeFieldOptions(field.type, patch.options, field.options);
    const required = patch.required === undefined ? field.required : patch.required === true && field.type !== "computed" && field.type !== "autonumber";

    // Renaming an option rewrites the stored values so records keep showing it.
    if ((field.type === "singleSelect" || field.type === "multiSelect") && options.choices && field.options.choices) {
      for (const next of options.choices) {
        const prev = field.options.choices.find((p) => p.id === next.id);
        if (!prev || prev.name === next.name) continue;
        if (field.type === "singleSelect") {
          await c.query("UPDATE boss_records SET data = jsonb_set(data, ARRAY[$2], to_jsonb($4::text)), updated_at = NOW() WHERE section_slug = $1 AND data->>$2 = $3", [slug, key, prev.name, next.name]);
        } else {
          await c.query(
            `UPDATE boss_records SET data = jsonb_set(data, ARRAY[$2], (SELECT jsonb_agg(CASE WHEN e = $3 THEN $4::text ELSE e END) FROM jsonb_array_elements_text(data->$2) e)), updated_at = NOW()
             WHERE section_slug = $1 AND jsonb_typeof(data->$2) = 'array' AND data->$2 ? $3`,
            [slug, key, prev.name, next.name],
          );
        }
      }
    }
    const res = await c.query<FieldRow>(
      "UPDATE boss_fields SET name = $3, options = $4::jsonb, required = $5, updated_at = NOW() WHERE table_slug = $1 AND key = $2 RETURNING key, name, type, options, position, required, is_primary",
      [slug, key, name, JSON.stringify(options), required],
    );
    return toField(res.rows[0]);
  });
}

/** Removes the field definition. Values already stored in records are kept (they are simply no longer shown). */
export async function deleteField(pool: Pool, slug: string, key: string): Promise<void> {
  assertTable(slug);
  await tx(pool, slug, async (c) => {
    const cur = await c.query<{ is_primary: boolean }>("SELECT is_primary FROM boss_fields WHERE table_slug = $1 AND key = $2", [slug, key]);
    if (!cur.rowCount) throw new ApiError(404, "Field not found.");
    if (cur.rows[0].is_primary) throw new ApiError(409, "The primary field names each record and cannot be deleted.");
    await c.query("DELETE FROM boss_fields WHERE table_slug = $1 AND key = $2", [slug, key]);
    const fields = await loadFields(c, slug);
    const views = await c.query<ViewRow>(`SELECT ${VIEW_COLUMNS} FROM boss_views WHERE table_slug = $1`, [slug]);
    for (const v of views.rows) {
      const pruned = pruneConfig(v.config, fields);
      if (JSON.stringify(pruned) !== JSON.stringify(v.config)) await c.query("UPDATE boss_views SET config = $2::jsonb, updated_at = NOW() WHERE id = $1", [v.id, JSON.stringify(pruned)]);
    }
  });
}

/* ----------------------------------------------------------------------- views */

function canSee(v: ViewRow, userId: string | null) {
  return v.access !== "personal" || v.owner_id === userId;
}

async function getViewRow(db: Db, slug: string, id: string, userId: string | null, lock = false): Promise<ViewRow> {
  const res = await db.query<ViewRow>(`SELECT ${VIEW_COLUMNS} FROM boss_views WHERE table_slug = $1 AND id = $2 ${lock ? "FOR UPDATE" : ""}`, [slug, id]);
  const row = res.rows[0];
  if (!row || !canSee(row, userId)) throw new ApiError(404, "View not found.");
  return row;
}

/** Collaborative: anyone. Personal: its owner. Locked: nobody, until its owner unlocks it. */
function assertCanEditView(v: ViewRow, userId: string | null) {
  if (v.access === "personal" && v.owner_id !== userId) throw new ApiError(403, "Only the owner can edit a personal view.");
  if (v.access === "locked") throw new ApiError(403, "This view is locked. Unlock it to make changes.");
}

async function viewNames(db: Db, slug: string, userId: string | null, exceptId?: string) {
  const res = await db.query<{ name: string }>("SELECT name FROM boss_views WHERE table_slug = $1 AND (access <> 'personal' OR owner_id = $2) AND id <> COALESCE($3, '')", [slug, userId, exceptId ?? null]);
  return res.rows.map((r) => r.name);
}

async function nextRootPosition(db: Db, slug: string): Promise<number> {
  const res = await db.query<{ p: number }>(
    `SELECT COALESCE(MAX(p) + 1, 0)::int AS p FROM (
       SELECT position AS p FROM boss_views WHERE table_slug = $1 AND section_id IS NULL
       UNION ALL SELECT position FROM boss_nav_sections WHERE table_slug = $1) x`,
    [slug],
  );
  return res.rows[0].p;
}

export async function createView(pool: Pool, slug: string, input: { name?: unknown; type?: unknown; access?: unknown; sectionId?: unknown; config?: unknown; category?: unknown }, userId: string | null): Promise<ViewDef> {
  const table = assertTable(slug);
  if (!userId) throw new ApiError(401, "No session.");
  if (typeof input.type !== "string" || !(VIEW_TYPES as readonly string[]).includes(input.type)) throw new ApiError(422, "Choose a view type.");
  const type = input.type as ViewType;
  const access: ViewAccess = input.access === "personal" || input.access === "locked" ? input.access : "collaborative";
  const name = cleanName(input.name, "View");
  return tx(pool, slug, async (c) => {
    const fields = await loadFields(c, slug);
    const names = await viewNames(c, slug, userId);
    const finalName = uniqueName(name, names);
    let sectionId: string | null = null;
    if (typeof input.sectionId === "string") {
      const s = await c.query("SELECT 1 FROM boss_nav_sections WHERE id = $1 AND table_slug = $2", [input.sectionId, slug]);
      if (!s.rowCount) throw new ApiError(422, "That section no longer exists.");
      sectionId = input.sectionId;
    }
    const base = defaultConfigFor(type, fields, table.name);
    // Supplied settings override the defaults, but a value that was invalid (and so dropped) must not blank a default.
    const config = input.config === undefined ? base : mergeDefined(base, normalizeViewConfig(input.config, fields));
    if (type === "form") {
      const category = input.category === "Vouchers" || input.category === "Work" ? input.category : (config.form?.category ?? "Work");
      config.form = { ...(config.form ?? base.form!), category };
    }
    const position = sectionId
      ? (await c.query<{ p: number }>("SELECT COALESCE(MAX(position) + 1, 0)::int AS p FROM boss_views WHERE section_id = $1", [sectionId])).rows[0].p
      : await nextRootPosition(c, slug);
    const res = await c.query<ViewRow>(
      `INSERT INTO boss_views (id, table_slug, name, type, config, access, owner_id, section_id, position) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9) RETURNING ${VIEW_COLUMNS}`,
      [newId("view"), slug, finalName, type, JSON.stringify(config), access, userId, sectionId, position],
    );
    return toView(res.rows[0]);
  });
}

export async function updateView(pool: Pool, slug: string, id: string, patch: { name?: unknown; config?: unknown; access?: unknown }, userId: string | null): Promise<ViewDef> {
  assertTable(slug);
  if (!userId) throw new ApiError(401, "No session.");
  return tx(pool, slug, async (c) => {
    const row = await getViewRow(c, slug, id, userId, true);
    const changingAccess = patch.access !== undefined && patch.access !== row.access;

    if (changingAccess) {
      // Only the owner (or anyone, for a view nobody owns yet) may change who can edit.
      if (row.owner_id && row.owner_id !== userId) throw new ApiError(403, "Only the owner can change who can edit this view.");
      if (patch.access !== "collaborative" && patch.access !== "personal" && patch.access !== "locked") throw new ApiError(422, "Choose who can edit this view.");
    }
    const onlyAccess = patch.name === undefined && patch.config === undefined;
    if (!(changingAccess && onlyAccess)) assertCanEditView(row, userId);

    const fields = await loadFields(c, slug);
    const name = patch.name === undefined ? row.name : uniqueName(cleanName(patch.name, "View"), await viewNames(c, slug, userId, id));
    const config = patch.config === undefined ? row.config : normalizeViewConfig(patch.config, fields);
    const access = changingAccess ? (patch.access as ViewAccess) : row.access;
    const owner = changingAccess ? (row.owner_id ?? userId) : row.owner_id;
    const res = await c.query<ViewRow>(
      `UPDATE boss_views SET name = $3, config = $4::jsonb, access = $5, owner_id = $6, updated_at = NOW() WHERE table_slug = $1 AND id = $2 RETURNING ${VIEW_COLUMNS}`,
      [slug, id, name, JSON.stringify(config), access, owner],
    );
    return toView(res.rows[0]);
  });
}

export async function deleteView(pool: Pool, slug: string, id: string, userId: string | null): Promise<void> {
  assertTable(slug);
  if (!userId) throw new ApiError(401, "No session.");
  await tx(pool, slug, async (c) => {
    const row = await getViewRow(c, slug, id, userId, true);
    assertCanEditView(row, userId);
    const others = await c.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM boss_views WHERE table_slug = $1 AND id <> $2 AND (access <> 'personal' OR owner_id = $3)", [slug, id, userId]);
    if (others.rows[0].n === 0) throw new ApiError(409, "A table needs at least one view. Create another view first.");
    await c.query("DELETE FROM boss_favorites WHERE kind = 'view' AND ref_id = $1", [id]);
    await c.query("DELETE FROM boss_views WHERE id = $1", [id]);
  });
}

export async function duplicateView(pool: Pool, slug: string, id: string, userId: string | null): Promise<ViewDef> {
  assertTable(slug);
  if (!userId) throw new ApiError(401, "No session.");
  return tx(pool, slug, async (c) => {
    const row = await getViewRow(c, slug, id, userId);
    const name = uniqueName(`${row.name} copy`, await viewNames(c, slug, userId));
    // Make room right after the original.
    if (row.section_id) await c.query("UPDATE boss_views SET position = position + 1 WHERE section_id = $1 AND position > $2", [row.section_id, row.position]);
    else {
      await c.query("UPDATE boss_views SET position = position + 1 WHERE table_slug = $1 AND section_id IS NULL AND position > $2", [slug, row.position]);
      await c.query("UPDATE boss_nav_sections SET position = position + 1 WHERE table_slug = $1 AND position > $2", [slug, row.position]);
    }
    const res = await c.query<ViewRow>(
      `INSERT INTO boss_views (id, table_slug, name, type, config, access, owner_id, section_id, position) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9) RETURNING ${VIEW_COLUMNS}`,
      [newId("view"), slug, name, row.type, JSON.stringify({ ...row.config, key: undefined }), row.access === "locked" ? "collaborative" : row.access, userId, row.section_id, row.position + 1],
    );
    return toView(res.rows[0]);
  });
}

/* -------------------------------------------------------------------- sections */

export async function createSection(pool: Pool, slug: string, input: { name?: unknown }, userId: string | null): Promise<SectionDef> {
  assertTable(slug);
  if (!userId) throw new ApiError(401, "No session.");
  const name = cleanName(input.name, "Section");
  return tx(pool, slug, async (c) => {
    const taken = await c.query<{ name: string }>("SELECT name FROM boss_nav_sections WHERE table_slug = $1", [slug]);
    const res = await c.query<{ id: string; table_slug: string; name: string; position: number }>(
      "INSERT INTO boss_nav_sections (id, table_slug, name, position, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id, table_slug, name, position",
      [newId("sec"), slug, uniqueName(name, taken.rows.map((r) => r.name)), await nextRootPosition(c, slug), userId],
    );
    return toSection(res.rows[0]);
  });
}

export async function renameSection(pool: Pool, slug: string, id: string, input: { name?: unknown }): Promise<SectionDef> {
  assertTable(slug);
  const name = cleanName(input.name, "Section");
  return tx(pool, slug, async (c) => {
    const taken = await c.query<{ name: string }>("SELECT name FROM boss_nav_sections WHERE table_slug = $1 AND id <> $2", [slug, id]);
    const res = await c.query<{ id: string; table_slug: string; name: string; position: number }>(
      "UPDATE boss_nav_sections SET name = $3 WHERE table_slug = $1 AND id = $2 RETURNING id, table_slug, name, position",
      [slug, id, uniqueName(name, taken.rows.map((r) => r.name))],
    );
    if (!res.rowCount) throw new ApiError(404, "Section not found.");
    return toSection(res.rows[0]);
  });
}

/** Deleting a section only dissolves the grouping: its views move to the sidebar root, in place. */
export async function deleteSection(pool: Pool, slug: string, id: string): Promise<{ moved: number }> {
  assertTable(slug);
  return tx(pool, slug, async (c) => {
    const sections = await c.query<{ id: string; table_slug: string; name: string; position: number }>("SELECT id, table_slug, name, position FROM boss_nav_sections WHERE table_slug = $1", [slug]);
    if (!sections.rows.some((s) => s.id === id)) throw new ApiError(404, "Section not found.");
    const views = await c.query<ViewRow>(`SELECT ${VIEW_COLUMNS} FROM boss_views WHERE table_slug = $1`, [slug]);
    const tree = buildTree(views.rows.map(toView), sections.rows.map(toSection));
    const flat = tree.root.flatMap((n) => (n.kind === "section" && n.section.id === id ? n.views.map((v) => ({ kind: "view" as const, view: v })) : [n]));
    const moved = tree.root.find((n) => n.kind === "section" && n.section.id === id);
    const nodes = treeToNodes({ root: flat });
    for (const n of nodes) {
      if (n.kind === "view") await c.query("UPDATE boss_views SET section_id = $3, position = $4 WHERE table_slug = $1 AND id = $2", [slug, n.id, n.parentId, n.position]);
      else await c.query("UPDATE boss_nav_sections SET position = $3 WHERE table_slug = $1 AND id = $2", [slug, n.id, n.position]);
    }
    await c.query("DELETE FROM boss_nav_sections WHERE table_slug = $1 AND id = $2", [slug, id]);
    return { moved: moved && moved.kind === "section" ? moved.views.length : 0 };
  });
}

/* ---------------------------------------------------------------------- layout */

export async function applyLayout(pool: Pool, slug: string, rawNodes: unknown, userId: string | null): Promise<{ views: ViewDef[]; sections: SectionDef[] }> {
  assertTable(slug);
  if (!userId) throw new ApiError(401, "No session.");
  if (!Array.isArray(rawNodes) || rawNodes.length > 1000) throw new ApiError(422, "Invalid layout.");
  const nodes: LayoutNode[] = rawNodes.map((n) => {
    const o = n as Record<string, unknown>;
    if ((o.kind !== "view" && o.kind !== "section") || typeof o.id !== "string" || typeof o.position !== "number" || !Number.isInteger(o.position) || o.position < 0) throw new ApiError(422, "Invalid layout.");
    if (o.parentId !== null && typeof o.parentId !== "string") throw new ApiError(422, "Invalid layout.");
    if (o.kind === "section" && o.parentId !== null) throw new ApiError(422, "Sections cannot be nested.");
    return { kind: o.kind, id: o.id, parentId: (o.parentId as string | null) ?? null, position: o.position };
  });
  if (new Set(nodes.map((n) => `${n.kind}:${n.id}`)).size !== nodes.length) throw new ApiError(422, "Invalid layout.");

  return tx(pool, slug, async (c) => {
    const views = await c.query<ViewRow>(`SELECT ${VIEW_COLUMNS} FROM boss_views WHERE table_slug = $1`, [slug]);
    const sections = await c.query<{ id: string; table_slug: string; name: string; position: number }>("SELECT id, table_slug, name, position FROM boss_nav_sections WHERE table_slug = $1", [slug]);
    const visibleViews = new Map(views.rows.filter((v) => canSee(v, userId)).map((v) => [v.id, v]));
    const sectionIds = new Set(sections.rows.map((s) => s.id));
    for (const n of nodes) {
      if (n.kind === "view" && !visibleViews.has(n.id)) throw new ApiError(404, "A view in this layout no longer exists.");
      if (n.kind === "section" && !sectionIds.has(n.id)) throw new ApiError(404, "A section in this layout no longer exists.");
      if (n.parentId && !sectionIds.has(n.parentId)) throw new ApiError(422, "A section in this layout no longer exists.");
    }
    for (const n of nodes) {
      if (n.kind === "view") await c.query("UPDATE boss_views SET section_id = $3, position = $4 WHERE table_slug = $1 AND id = $2", [slug, n.id, n.parentId, n.position]);
      else await c.query("UPDATE boss_nav_sections SET position = $3 WHERE table_slug = $1 AND id = $2", [slug, n.id, n.position]);
    }
    const applied = applyNodes(views.rows.map(toView), sections.rows.map(toSection), nodes);
    return { views: applied.views.filter((v) => visibleViews.has(v.id)), sections: applied.sections };
  });
}

/* ------------------------------------------------------------------- favorites */

export async function setFavorite(pool: Pool, slug: string, input: { kind?: unknown; refId?: unknown; favorite?: unknown }, userId: string | null): Promise<void> {
  assertTable(slug);
  if (!userId) throw new ApiError(401, "No session.");
  if ((input.kind !== "view" && input.kind !== "record") || typeof input.refId !== "string" || typeof input.favorite !== "boolean") throw new ApiError(422, "Invalid favorite.");
  const { kind, refId } = input as { kind: "view" | "record"; refId: string };
  if (!input.favorite) {
    await pool.query("DELETE FROM boss_favorites WHERE owner_id = $1 AND kind = $2 AND ref_id = $3 AND table_slug = $4", [userId, kind, refId, slug]);
    return;
  }
  if (kind === "view") await getViewRow(pool, slug, refId, userId);
  else {
    const r = await pool.query("SELECT 1 FROM boss_records WHERE section_slug = $1 AND record_id = $2", [slug, refId]);
    if (!r.rowCount) throw new ApiError(404, "Record not found.");
  }
  await pool.query(
    `INSERT INTO boss_favorites (owner_id, table_slug, kind, ref_id, position)
     VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(position) + 1 FROM boss_favorites WHERE owner_id = $1 AND table_slug = $2), 0))
     ON CONFLICT (owner_id, kind, ref_id) DO NOTHING`,
    [userId, slug, kind, refId],
  );
}

/* ----------------------------------------------------------------------- forms */

export async function submitForm(pool: Pool, slug: string, viewId: string, input: Record<string, unknown>, userId: string | null): Promise<RecordRow> {
  assertTable(slug);
  const view = await getViewRow(pool, slug, viewId, userId);
  if (view.type !== "form" || !view.config.form) throw new ApiError(404, "Form not found.");
  const visible = view.config.form.fields.filter((f) => f.visible);
  return createRecord(pool, slug, input, {
    allowedKeys: new Set(visible.map((f) => f.key)),
    requiredKeys: new Set(visible.filter((f) => f.required).map((f) => f.key)),
  });
}

/* ----------------------------------------------------------------------- files */

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "application/pdf", "text/plain", "text/csv", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Check the leading bytes so a file cannot claim to be an image while being something else. */
function sniff(mime: string, b: Buffer): boolean {
  if (mime === "image/png") return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (mime === "image/gif") return b.subarray(0, 3).toString("ascii") === "GIF";
  if (mime === "image/webp") return b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP";
  if (mime === "image/avif") return b.subarray(4, 12).toString("ascii").startsWith("ftyp");
  if (mime === "application/pdf") return b.subarray(0, 5).toString("ascii") === "%PDF-";
  return true;
}

export async function saveFile(pool: Pool, input: { name: string; mime: string; bytes: Buffer }, userId: string | null) {
  if (!userId) throw new ApiError(401, "No session.");
  if (!ALLOWED_MIME.has(input.mime)) throw new ApiError(415, "That file type is not allowed. Use an image, PDF, text, Word or Excel file.");
  if (input.bytes.length === 0) throw new ApiError(422, "The file is empty.");
  if (input.bytes.length > MAX_FILE_BYTES) throw new ApiError(413, "Files can be up to 5 MB.");
  if (!sniff(input.mime, input.bytes)) throw new ApiError(415, "The file contents do not match its type.");
  const id = newId("file").replace("file_", "");
  const name = input.name.replace(/[\\/\0]/g, "_").slice(0, 200) || "file";
  await pool.query("INSERT INTO boss_files (id, name, mime, size, data, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6)", [id, name, input.mime, input.bytes.length, input.bytes, userId]);
  return { id, name, url: `/api/files/${id}`, type: input.mime, size: input.bytes.length };
}

export async function getFile(pool: Pool, id: string) {
  if (!/^[a-z0-9]{6,40}$/.test(id)) return null;
  const res = await pool.query<{ name: string; mime: string; data: Buffer }>("SELECT name, mime, data FROM boss_files WHERE id = $1", [id]);
  return res.rows[0] ?? null;
}

/* ------------------------------------------------------------------- server query */

function parseQuery(raw: Record<string, unknown>, fields: FieldDef[]): RecordQuery {
  const cfg = normalizeViewConfig({ filters: raw.filters, sort: raw.sort }, fields);
  const limit = typeof raw.limit === "number" ? raw.limit : serverPage();
  const offset = typeof raw.offset === "number" ? raw.offset : 0;
  return { filters: cfg.filters, sort: cfg.sort, search: typeof raw.search === "string" ? raw.search.slice(0, 200) : "", limit, offset };
}

/** Filtered, searched, sorted page of a table, computed by PostgreSQL. */
export async function queryTable(pool: Pool, slug: string, raw: Record<string, unknown>): Promise<{ records: RecordRow[]; total: number }> {
  assertTable(slug);
  const fields = await loadFields(pool, slug);
  const q = parseQuery(raw, fields);
  try {
    const built = buildRecordQuery(slug, fields, q);
    const res = await pool.query<{ data: RecordRow; total: number }>(built.text, built.values);
    return { records: res.rows.map((r) => r.data), total: res.rows[0]?.total ?? 0 };
  } catch (e) {
    if (e instanceof UnsupportedFilterError) throw new ApiError(422, e.message);
    throw e;
  }
}
