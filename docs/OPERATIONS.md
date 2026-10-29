# BOSS production operations

## Data and replication boundaries

Supabase is the primary for the PostgreSQL-backed BOSS tables. The Railway database
`boss_supabase_standby` receives one-way asynchronous logical replication. The old Railway
`railway` database is a read-only pre-cutover archive, not the current standby.

Replication is not automatic failover, load balancing, or an independent backup: deletions and mistakes
also replicate. DDL, indexes, sequences, roles, and Supabase Auth users/sessions do not replicate through
the application publication. Apply compatible schema changes on the subscriber before corresponding
primary data changes. A prolonged subscriber outage can invalidate its replication slot and require reseeding.

The `boss_views_section_idx` and `boss_favorites_table_idx` indexes are additive and idempotent in
`db/schema.sql`; they must exist on both databases. Do not run startup data migrations on the subscriber.

The newer AIS accounting UI currently uses browser localStorage (`src/services/ais/repository.ts`). It
is not PostgreSQL-backed, shared across users, or replicated. Its accounting features were deliberately
left unchanged during security hardening. Export/reconcile existing browser data before implementing
a separate accounting persistence migration. Multiplexer/EDI remains proposed, not deployed.

## Access setup

Configure Railway app variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `BOSS_APP_ORIGIN`, and
`BOSS_ADMIN_EMAILS`. The approved list is server-side and grants administrator access; there are no
separate staff or partner roles yet. Do not put secret/service-role keys in the browser or repository.
Keep public signup, anonymous sign-in, and manual account linking disabled in Supabase Auth.

Provision an approved email using Supabase Auth's **Invite user** action. Invitations and password
recovery emails must link to the actual BOSS host with these paths:

```html
<!-- Invite user email -->
<a href="https://YOUR-BOSS-HOST/auth/confirm?token_hash={{ .TokenHash }}&amp;type=invite">Set up BOSS</a>
<!-- Reset password email -->
<a href="https://YOUR-BOSS-HOST/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
```

The confirmation page requires a deliberate button press, verifies the token server-side, checks
the approved email, then opens password setup. Users choose their own password (minimum 12 characters).
Never collect passwords or invitation tokens in chat, logs, screenshots, or issue trackers.

Supabase's built-in email service is restricted and rate-limited; configure a verified production SMTP
provider before onboarding staff broadly. Password sign-in does not send an email on every login.
Session sign-out clears cookies and revokes the refresh session; already issued access tokens may remain
valid until expiry. Remove an email from `BOSS_ADMIN_EMAILS` and deploy to revoke application access
independently. MFA, granular permissions, and short session policy need a separate rollout.

Supabase browser table grants remain revoked and RLS remains enabled. The backend uses `boss_app`,
which owns the application tables, so route-level authorization is essential. The RLS-without-policy
informational advisory is intentional for backend-only access; do not silence it with permissive policies.

Legacy anonymous favorites/personal views are retained but not automatically claimed by an authenticated
user. Review existing owners before a controlled reassignment. Uploaded attachment access now requires login.
The bundled voucher PDF is also protected at the application URL, but the public GitHub repository already
contains that sample PDF and seed content. Review repository visibility/content separately if confidential.

## Deployment and checks

The Railway service's start command must preserve its existing CA bootstrap, then run `npm start`.
`DATABASE_URL` must continue to target Supabase with `sslmode=verify-full` and the CA file path. Do not
replace it with the old Railway archive URL or set `PGSSLMODE=require` (which disables certificate verification).

Railway deployment healthcheck: `/api/health`, timeout 120 seconds. This is a deployment readiness check,
not continuous uptime monitoring. Preserve the start command and all unrelated service variables.

GitHub CI uses Node 24 and a disposable PostgreSQL 17 service: dependency audit, type-check, all unit and
database integration tests, production build, and HTTP authentication smoke tests. HTTP tests use a local
Auth test double; real email delivery and administrator login still require a live acceptance check.
Tests require `TEST_DATABASE_URL` on localhost and never inherit the app's `DATABASE_URL`.

After deployment, verify `/api/health`, unauthenticated API denial, authenticated table/file access,
password setup, logout, primary replication slot activity and subscriber LSN progress. Never log secrets.
Application rollback must target an authenticated revision; reverting to the pre-hardening revision
would reopen anonymous access. Indexes can safely remain installed during an application rollback.

## Outstanding resilience work

Configure independent backup retention and perform a restore drill; define recovery objectives and an
explicit failover/failback runbook including Auth availability and sequence synchronization. Add external
uptime/replication-lag alerts with an agreed destination. Neither automatic failover nor ongoing scheduled
monitoring was introduced by this hardening change.
