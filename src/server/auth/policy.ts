import { timingSafeEqual } from 'node:crypto';

export function isAdminEmail(email: string | undefined, configured = process.env.BOSS_ADMIN_EMAILS): boolean {
  const allowed = (configured ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.trim().toLowerCase());
}

export function hasServiceToken(request: Request, expected = process.env.API_WRITE_TOKEN): boolean {
  if (!expected) return false;
  const actual = request.headers.get('authorization') ?? '';
  const wanted = `Bearer ${expected}`;
  return Buffer.byteLength(actual) === Buffer.byteLength(wanted) && timingSafeEqual(Buffer.from(actual), Buffer.from(wanted));
}

export function trustedOrigin(request: Request, configured = process.env.BOSS_APP_ORIGIN): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin || !configured) return false;
  try { return new URL(origin).origin === new URL(configured).origin; } catch { return false; }
}

export function authorizedUser(user: { id: string; email?: string; email_confirmed_at?: string; is_anonymous?: boolean } | null,
  configured = process.env.BOSS_ADMIN_EMAILS) {
  return user && !user.is_anonymous && user.email_confirmed_at && isAdminEmail(user.email, configured) ? user : null;
}
