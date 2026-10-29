import assert from 'node:assert/strict';
import { it } from 'node:test';
import { testDatabaseUrl } from './testDatabaseUrl';

it('never uses the production application database for integration tests', () => {
  assert.equal(testDatabaseUrl({ DATABASE_URL: 'postgres://production.invalid/postgres' }), undefined);
});

it('allows an explicitly selected local test database', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const value = `postgres://test@${host}:55439/postgres`;
    assert.equal(testDatabaseUrl({ TEST_DATABASE_URL: value }), value);
  }
});

it('rejects remote databases and non-PostgreSQL URLs', () => {
  for (const value of ['postgres://production.invalid/postgres', 'https://localhost/test']) {
    assert.throws(() => testDatabaseUrl({ TEST_DATABASE_URL: value }), /isolated PostgreSQL/);
  }
});
