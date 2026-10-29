CREATE TABLE IF NOT EXISTS boss_sections (
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  airtable_base_id TEXT NOT NULL DEFAULT 'app8QxH2cjt0fueuW',
  airtable_table_name TEXT NOT NULL,
  range_from INTEGER,
  range_to INTEGER,
  range_total INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boss_groups (
  section_slug TEXT NOT NULL REFERENCES boss_sections(slug) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  label TEXT,
  display_count INTEGER,
  sums JSONB,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (section_slug, group_id)
);

CREATE TABLE IF NOT EXISTS boss_records (
  section_slug TEXT NOT NULL,
  record_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (section_slug, record_id),
  FOREIGN KEY (section_slug, group_id)
    REFERENCES boss_groups(section_slug, group_id) ON DELETE CASCADE,
  CONSTRAINT boss_records_data_object CHECK (jsonb_typeof(data) = 'object'),
  CONSTRAINT boss_records_id_matches CHECK (data->>'id' = record_id)
);

CREATE INDEX IF NOT EXISTS boss_records_section_group_position_idx
  ON boss_records(section_slug, group_id, position);

-- Exact, read-only mirror of Airtable CSV exports. The frontend-facing
-- boss_* tables above keep their stable typed contract while this pair keeps
-- every source column without requiring a schema migration for new fields.
CREATE TABLE IF NOT EXISTS airtable_tables (
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  source_base_id TEXT NOT NULL DEFAULT 'app8QxH2cjt0fueuW',
  source_view_name TEXT NOT NULL,
  columns JSONB NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airtable_tables_columns_array CHECK (jsonb_typeof(columns) = 'array')
);

CREATE TABLE IF NOT EXISTS airtable_records (
  table_slug TEXT NOT NULL REFERENCES airtable_tables(slug) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (table_slug, row_number),
  CONSTRAINT airtable_records_data_object CHECK (jsonb_typeof(data) = 'object')
);

CREATE INDEX IF NOT EXISTS airtable_records_table_row_idx
  ON airtable_records(table_slug, row_number);

-- ---------------------------------------------------------------------------
-- Table engine (fields, views, sidebar sections, favorites, files).
-- Purely additive: existing boss_* and airtable_* tables are left untouched.
-- `boss_sections.slug` is the table id; record JSON keys are `boss_fields.key`.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS boss_fields (
  table_slug TEXT NOT NULL REFERENCES boss_sections(slug) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_slug, key),
  CONSTRAINT boss_fields_options_object CHECK (jsonb_typeof(options) = 'object'),
  CONSTRAINT boss_fields_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS boss_fields_one_primary_idx
  ON boss_fields(table_slug) WHERE is_primary;

-- Named groups of views in the sidebar ("Section" / folder). Deleting one never deletes a view.
CREATE TABLE IF NOT EXISTS boss_nav_sections (
  id TEXT PRIMARY KEY,
  table_slug TEXT NOT NULL REFERENCES boss_sections(slug) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT boss_nav_sections_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS boss_nav_sections_table_idx ON boss_nav_sections(table_slug, position);

CREATE TABLE IF NOT EXISTS boss_views (
  id TEXT PRIMARY KEY,
  table_slug TEXT NOT NULL REFERENCES boss_sections(slug) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  access TEXT NOT NULL DEFAULT 'collaborative',
  owner_id TEXT,
  -- ON DELETE SET NULL: removing a section moves its views back to the sidebar root.
  section_id TEXT REFERENCES boss_nav_sections(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT boss_views_type_valid CHECK (type IN ('grid','calendar','gallery','kanban','timeline','list','gantt','form')),
  CONSTRAINT boss_views_access_valid CHECK (access IN ('collaborative','personal','locked')),
  CONSTRAINT boss_views_config_object CHECK (jsonb_typeof(config) = 'object'),
  CONSTRAINT boss_views_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS boss_views_table_idx ON boss_views(table_slug, position);
CREATE INDEX IF NOT EXISTS boss_views_section_idx ON boss_views(section_id);

CREATE TABLE IF NOT EXISTS boss_favorites (
  owner_id TEXT NOT NULL,
  table_slug TEXT NOT NULL REFERENCES boss_sections(slug) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, kind, ref_id),
  CONSTRAINT boss_favorites_kind_valid CHECK (kind IN ('view','record'))
);

CREATE INDEX IF NOT EXISTS boss_favorites_owner_table_idx ON boss_favorites(owner_id, table_slug, position);
CREATE INDEX IF NOT EXISTS boss_favorites_table_idx ON boss_favorites(table_slug);

-- Uploaded attachments (profile pictures, QR codes, files). Bytes live in the database so a
-- Railway deploy needs no extra storage service.
CREATE TABLE IF NOT EXISTS boss_files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BYTEA NOT NULL,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT boss_files_size_limit CHECK (size >= 0 AND size <= 8388608)
);

-- One-time data migrations (backfills) are recorded here so they never run twice.
CREATE TABLE IF NOT EXISTS boss_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Race-safe autonumbers: one counter row per (table, field).
CREATE TABLE IF NOT EXISTS boss_counters (
  table_slug TEXT NOT NULL REFERENCES boss_sections(slug) ON DELETE CASCADE,
  key TEXT NOT NULL,
  next_value BIGINT NOT NULL,
  PRIMARY KEY (table_slug, key)
);
