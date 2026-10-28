#!/bin/sh
# Recreate a local database from scratch (schema + seed + migrations). For test runs only: it DROPS the database.
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/boss sh qa/fresh-db.sh
set -e
: "${DATABASE_URL:?DATABASE_URL is required}"
DB=$(echo "$DATABASE_URL" | sed 's#.*/##')
ADMIN=$(echo "$DATABASE_URL" | sed "s#/$DB\$#/postgres#")
psql "$ADMIN" -q -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -c "CREATE DATABASE $DB"
npx tsx scripts/migrate.ts
