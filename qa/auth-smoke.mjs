// Production Next.js HTTP boundaries against isolated PostgreSQL and a local Auth test double.
// No real Supabase account, email, production database, or service credential is used.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID, createHmac } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const adminUrl = process.env.TEST_DATABASE_URL;
assert.ok(adminUrl, 'TEST_DATABASE_URL is required for auth smoke tests');
const adminConnection = new URL(adminUrl);
assert.ok(['postgres:', 'postgresql:'].includes(adminConnection.protocol));
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(adminConnection.hostname), 'Only isolated localhost databases are allowed');
const admin = new pg.Pool({ connectionString: adminUrl });
const dbName = `boss_test_auth_${Date.now()}`;
const dbUrl = new URL(adminUrl);
dbUrl.pathname = `/${dbName}`;
const user = { id: randomUUID(), email: 'admin@example.test', aud: 'authenticated', role: 'authenticated',
  email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, identities: [] };
let activeUser = user;
let validSession = true;
let confirmations = 0;
const secret = randomUUID();
const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}`;
const token = `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
const session = () => ({ access_token: token, refresh_token: 'local-test-refresh', expires_in: 3600, token_type: 'bearer', user: activeUser });
const auth = createServer(async (req, res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  const path = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Content-Type', 'application/json');
  const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (path === '/auth/v1/token' && body.email === user.email && body.password === 'local-test-password') {
    validSession = true; return send(200, session());
  }
  if (path === '/auth/v1/user' && req.headers.authorization === `Bearer ${token}` && validSession) return send(200, activeUser);
  if (path === '/auth/v1/logout') { validSession = false; return send(200, {}); }
  if (path === '/auth/v1/verify') {
    confirmations += 1;
    if (body.token_hash === 'a'.repeat(64) && body.type === 'invite') { validSession = true; return send(200, session()); }
  }
  return send(401, { code: 'invalid_credentials', message: 'Invalid test credentials' });
});
let app;
let logs = '';
try {
  await admin.query(`CREATE DATABASE ${dbName}`);
  auth.listen(0, '127.0.0.1'); await once(auth, 'listening');
  const portProbe = createServer(); portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening');
  const appPort = portProbe.address().port; await new Promise((resolve) => portProbe.close(resolve));
  const origin = `http://127.0.0.1:${appPort}`;
  const env = { ...process.env, NODE_ENV: 'production', DATABASE_URL: dbUrl.toString(), PGSSLMODE: 'disable',
    SUPABASE_URL: `http://127.0.0.1:${auth.address().port}`, SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    BOSS_APP_ORIGIN: origin, BOSS_ADMIN_EMAILS: user.email, API_WRITE_TOKEN: 'local-test-service-token' };
  const migrated = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/migrate.ts'], { env, encoding: 'utf8' });
  assert.equal(migrated.status, 0, migrated.stderr);
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(appPort)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  app.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-4000); });
  app.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-4000); });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/api/health`)).ok) { ready = true; break; } } catch { /* starting */ }
    await delay(200);
  }
  assert.ok(ready, `App did not become healthy: ${logs}`);
  const jar = new Map();
  async function request(path, { method = 'GET', body, headers = {}, cookies = false } = {}) {
    const response = await fetch(`${origin}${path}`, { method, redirect: 'manual',
      headers: { ...(method !== 'GET' ? { origin, 'content-type': 'application/json' } : {}),
        ...(cookies ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body) });
    if (cookies) for (const value of response.headers.getSetCookie()) {
      const [cookie] = value.split(';'); const separator = cookie.indexOf('=');
      jar.set(cookie.slice(0, separator), cookie.slice(separator + 1));
    }
    return response;
  }
  for (const path of ['/api/base/tables/profiles', '/api/files/missing', '/api/base/files/missing', '/api/records/profiles', '/api/airtable', '/vouchers/Voucher.pdf']) {
    assert.equal((await request(path)).status, 401, `Anonymous access: ${path}`);
    assert.equal((await request(path, { headers: { cookie: `boss_uid=${'a'.repeat(32)}` } })).status, 401, `Forged legacy cookie: ${path}`);
  }
  for (const path of ['/profiles', '/ais', '/ais/accounts', '/set-password']) {
    const r = await request(path); assert.equal(r.status, 307, path); assert.equal(r.headers.get('location'), '/sign-in');
  }
  assert.equal((await request('/api/auth/login', { method: 'POST', body: {}, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: 'outsider@example.test', password: 'whatever' } })).status, 401);
  assert.equal((await request('/api/base/tables/profiles', { headers: { authorization: 'Bearer local-test-service-token' } })).status, 200);
  const login = await request('/api/auth/login', { method: 'POST', body: { email: user.email, password: 'local-test-password' }, cookies: true });
  assert.equal(login.status, 200, await login.text());
  assert.ok(login.headers.getSetCookie().some((value) => /httponly/i.test(value) && /secure/i.test(value) && /samesite=lax/i.test(value)));
  assert.equal((await request('/api/base/tables/profiles', { cookies: true })).status, 200);
  assert.equal((await request('/profiles', { cookies: true })).status, 200);
  assert.equal((await request('/vouchers/Voucher.pdf', { cookies: true })).status, 200);
  assert.equal((await request('/ais', { cookies: true })).status, 200);
  const identity = await request('/api/base/session', { method: 'POST', body: {}, cookies: true });
  assert.equal((await identity.json()).userId, user.id, 'Personal state uses verified identity');
  assert.equal((await request('/api/base/session', { method: 'POST', body: {}, cookies: true, headers: { origin: 'https://evil.example' } })).status, 401);
  activeUser = { ...user, email: 'revoked@example.test' };
  assert.equal((await request('/api/base/tables/profiles', { cookies: true })).status, 401, 'Fresh authorization rejects changed email');
  activeUser = user;
  assert.equal((await request('/api/auth/logout', { method: 'POST', body: {}, cookies: true })).status, 200);
  assert.equal((await request('/api/base/tables/profiles', { cookies: true })).status, 401);
  const confirmationPage = await request(`/auth/confirm?token_hash=${'a'.repeat(64)}&type=invite`);
  assert.equal(confirmationPage.status, 200); assert.equal(confirmations, 0, 'GET must not consume invitation tokens');
  assert.equal((await request('/api/auth/confirm', { method: 'POST', cookies: true, body: { token_hash: 'a'.repeat(64), type: 'invite' } })).status, 200);
  assert.equal(confirmations, 1);
  assert.equal((await request('/set-password', { cookies: true })).status, 200);
  assert.equal((await request('/api/auth/password', { method: 'POST', cookies: true, body: { password: 'short' } })).status, 422);
  assert.equal((await request('/api/auth/password', { method: 'POST', cookies: true, body: { password: 'long-local-test-password' } })).status, 200);
  console.log('Auth HTTP smoke passed: anonymous blocking, forged cookies, CSRF, service token, login, identity, revocation, logout, invitation and password setup.');
} catch (error) { console.error(error); console.error(logs); process.exitCode = 1; }
finally {
  if (app && app.exitCode === null) { app.kill('SIGTERM'); await once(app, 'exit'); }
  await new Promise((resolve) => auth.close(resolve));
  await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await admin.end();
}
