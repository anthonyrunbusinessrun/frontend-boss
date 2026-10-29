import 'server-only';
import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authorizedUser, hasServiceToken, trustedOrigin } from './policy';

export async function authClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase authentication is not configured.');
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Server Components are read-only; proxy.ts refreshes page-request cookies.
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* read-only render */ }
      },
    },
  });
}

export const currentUser = cache(async () => {
  try {
    const client = await authClient();
    const { data, error } = await client.auth.getUser();
    return error ? null : authorizedUser(data.user);
  } catch { return null; }
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  return user;
}

export async function apiIdentity(request: Request) {
  if (hasServiceToken(request)) return { userId: null, service: true };
  if (!['GET', 'HEAD'].includes(request.method) && !trustedOrigin(request)) return null;
  const user = await currentUser();
  return user ? { userId: user.id, service: false } : null;
}
