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
