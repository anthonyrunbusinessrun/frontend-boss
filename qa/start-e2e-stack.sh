#!/bin/sh
# Local browser-test stack: fresh database, a fake Auth server, the app on :3100 and a second app instance on :3101
# that filters on the server (tiny threshold / page). Needs `npm run build` first. Test databases only: it DROPS the database.
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/boss sh qa/start-e2e-stack.sh
set -e
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?DATABASE_URL is required}"
sh qa/fresh-db.sh >/tmp/e2e-migrate.log 2>&1
pkill -f "^next-server" 2>/dev/null || true; pkill -f "qa/fake-auth.mjs" 2>/dev/null || true
sleep 1
export SUPABASE_URL=http://127.0.0.1:3299 SUPABASE_PUBLISHABLE_KEY=local-test-key BOSS_ADMIN_EMAILS=admin@example.test API_WRITE_TOKEN=local-test-service-token PGSSLMODE=disable
setsid nohup node qa/fake-auth.mjs 3299 >/tmp/fake-auth.log 2>&1 &
BOSS_APP_ORIGIN=http://localhost:3100 setsid nohup npx next start -p 3100 >/tmp/next.log 2>&1 &
BOSS_APP_ORIGIN=http://localhost:3101 BOSS_SERVER_QUERY_THRESHOLD=5 BOSS_SERVER_PAGE=6 setsid nohup npx next start -p 3101 >/tmp/next2.log 2>&1 &
sleep 7
echo "stack up: app :3100, server-filter app :3101, fake auth :3299 (admin@example.test / local-test-password)"
