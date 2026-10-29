import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authorizedUser, hasServiceToken } from '@/server/auth/policy';

/** Refresh page cookies only. Authorization is enforced again at every data boundary. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const protectedFile = request.nextUrl.pathname.startsWith('/vouchers/');
  const denied = () => NextResponse.json({ error: 'Please sign in.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  if (protectedFile && hasServiceToken(request)) return response;
  if (!url || !key || !request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) return protectedFile ? denied() : response;
  const client = createServerClient(url, key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        response.headers.set('Cache-Control', 'private, no-store');
        response.headers.set('Referrer-Policy', 'no-referrer');
      },
    },
  });
  try {
    if (protectedFile) {
      const { data, error } = await client.auth.getUser();
      if (error || !authorizedUser(data.user)) return denied();
    } else await client.auth.getClaims();
  } catch { if (protectedFile) return denied(); }
  return response;
}

export const config = { matcher: ['/((?!api/|_next/|assets/|brand/|icon.png|favicon.ico).*)'] };
