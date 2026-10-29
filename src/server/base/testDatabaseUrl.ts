/** Integration tests must never inherit the application's production DATABASE_URL. */
export function testDatabaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  const value = env.TEST_DATABASE_URL;
  if (!value) return undefined;
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('TEST_DATABASE_URL must point to an isolated PostgreSQL server on localhost.');
  }
  return value;
}
