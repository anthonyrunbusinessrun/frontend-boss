// A stand-in for Supabase Auth, for LOCAL browser tests only (same idea as qa/auth-smoke.mjs). It knows one approved
// user and accepts one fixed password. Nothing here talks to a real Supabase project.
//   node qa/fake-auth.mjs [port]      (default 3299)
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 3299);
const user = { id: randomUUID(), email: 'admin@example.test', aud: 'authenticated', role: 'authenticated',
  email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, identities: [] };
const secret = randomUUID();
const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 })}`;
const token = `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
let valid = true;
createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  const path = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Content-Type', 'application/json');
  const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (path === '/auth/v1/token' && body.email === user.email && body.password === 'local-test-password') {
    valid = true;
    return send(200, { access_token: token, refresh_token: 'local-test-refresh', expires_in: 86400, token_type: 'bearer', user });
  }
  if (path === '/auth/v1/user' && req.headers.authorization === `Bearer ${token}` && valid) return send(200, user);
  if (path === '/auth/v1/logout') { valid = false; return send(200, {}); }
  return send(401, { code: 'invalid_credentials', message: 'Invalid test credentials' });
}).listen(port, '127.0.0.1', () => console.log(`fake auth on ${port}`));
