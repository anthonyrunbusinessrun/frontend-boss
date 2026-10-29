import { NextResponse } from 'next/server';
import { authClient, currentUser } from '@/server/auth/server';
import { authorizedUser, isAdminEmail, trustedOrigin } from '@/server/auth/policy';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
});

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  if (!trustedOrigin(request)) return reply({ error: 'Cross-site requests are not allowed.' }, 403);
  const { action } = await params;
  try {
    const text = await request.text();
    if (text.length > 8192) return reply({ error: 'Request too large.' }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(text || '{}'); } catch { return reply({ error: 'Invalid request.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid request.' }, 400);
    const client = await authClient();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (action === 'login') {
      if (!isAdminEmail(email) || !password || password.length > 256) return reply({ error: 'Email or password is incorrect, or access has not been approved.' }, 401);
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !authorizedUser(data.user)) {
        if (data.session) await client.auth.signOut({ scope: 'local' });
        return reply({ error: 'Email or password is incorrect, or access has not been approved.' }, 401);
      }
      return reply({ ok: true });
    }
    if (action === 'recover') {
      // The same response avoids revealing the access list. Supabase enforces email rate limits.
      if (isAdminEmail(email)) {
        const { error } = await client.auth.resetPasswordForEmail(email);
        if (error) return reply({ error: 'Recovery email could not be sent. Please wait and try again or contact your administrator.' }, 429);
      }
      return reply({ ok: true, message: 'If this address has approved access, a recovery email will arrive shortly.' });
    }
    if (action === 'confirm') {
      const type = body.type;
      const token_hash = body.token_hash;
      if (!['invite', 'recovery'].includes(String(type)) || typeof token_hash !== 'string' || !/^[a-f0-9]{32,128}$/i.test(token_hash)) return reply({ error: 'Invalid invitation or recovery link.' }, 400);
      const { data, error } = await client.auth.verifyOtp({ token_hash, type: type as 'invite' | 'recovery' });
      if (error || !authorizedUser(data.user)) {
        if (data.session) await client.auth.signOut({ scope: 'local' });
        return reply({ error: 'This link has expired, was already used, or access has not been approved.' }, 401);
      }
      return reply({ ok: true });
    }
    if (action === 'password') {
      if (!await currentUser()) return reply({ error: 'Please sign in again.' }, 401);
      if (password.length < 12 || password.length > 256) return reply({ error: 'Choose a password between 12 and 256 characters.' }, 422);
      const { error } = await client.auth.updateUser({ password });
      if (error) return reply({ error: 'Password could not be updated. Use a different password or request a new recovery link.' }, 422);
      return reply({ ok: true });
    }
    if (action === 'logout') {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) return reply({ error: 'Sign-out failed. Please try again.' }, 503);
      return reply({ ok: true });
    }
    return reply({ error: 'Not found.' }, 404);
  } catch { return reply({ error: 'Sign-in is temporarily unavailable. Please try again.' }, 503); }
}
