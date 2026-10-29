import assert from 'node:assert/strict';
import { it } from 'node:test';
import { authorizedUser, hasServiceToken, isAdminEmail, trustedOrigin } from './policy';

it('only explicitly approved email addresses can access BOSS', () => {
  assert.equal(isAdminEmail('Admin@EXAMPLE.com', ' admin@example.com '), true);
  assert.equal(isAdminEmail('outsider@example.com', 'admin@example.com'), false);
  assert.equal(isAdminEmail('admin@example.com', ''), false);
});

it('requires confirmed non-anonymous identity, not editable metadata', () => {
  const user = { id: 'verified-id', email: 'admin@example.com', email_confirmed_at: '2026-10-29' };
  assert.equal(authorizedUser(user, user.email), user);
  assert.equal(authorizedUser({ ...user, email_confirmed_at: undefined }, user.email), null);
  assert.equal(authorizedUser({ ...user, is_anonymous: true }, user.email), null);
  assert.equal(authorizedUser({ ...user, email: 'outsider@example.com' }, user.email), null);
  assert.equal(authorizedUser(null, user.email), null);
});

it('rejects missing, malformed and incorrect service tokens', () => {
  const request = (authorization?: string) => new Request('https://boss.example/api/base', { headers: authorization ? { authorization } : {} });
  assert.equal(hasServiceToken(request('Bearer secret'), 'secret'), true);
  assert.equal(hasServiceToken(request('Bearer wrong!'), 'secret'), false);
  assert.equal(hasServiceToken(request('Bearer secret'), ''), false);
  assert.equal(hasServiceToken(request(), 'secret'), false);
});

it('requires the configured origin, rejecting forged forwarded hosts and cross-site requests', () => {
  const req = (headers: Record<string, string>) => new Request('https://boss.example/api/auth/login', { method: 'POST', headers });
  assert.equal(trustedOrigin(req({ origin: 'https://boss.example' }), 'https://boss.example'), true);
  assert.equal(trustedOrigin(req({ origin: 'https://evil.example', 'x-forwarded-host': 'evil.example', 'sec-fetch-site': 'same-origin' }), 'https://boss.example'), false);
  assert.equal(trustedOrigin(req({ origin: 'https://boss.example', 'sec-fetch-site': 'cross-site' }), 'https://boss.example'), false);
  assert.equal(trustedOrigin(req({ 'sec-fetch-site': 'none' }), 'https://boss.example'), false);
  assert.equal(trustedOrigin(req({ origin: 'https://boss.example' }), ''), false);
});
