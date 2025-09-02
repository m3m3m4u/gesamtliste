import { NextResponse } from 'next/server';
import { EMBED_COOKIE_NAME } from '@/lib/embedGuard';

export async function POST(request: Request) {
  const require = process.env.REQUIRE_EMBED === '1';
  const expected = process.env.EMBED_TOKEN;
  if (require) {
    let token: string | undefined;
    try {
      const body = await request.json().catch(()=>({}));
      token = body?.token;
    } catch {}
    if (!token) {
      // Fallback: Queryparam aus URL
      try { const u = new URL(request.url); token = u.searchParams.get('token') || u.searchParams.get('embed') || undefined; } catch {}
    }
    if (!expected || token !== expected) {
      return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 403 });
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(EMBED_COOKIE_NAME, '1', {
    path: '/',
    httpOnly: true,
    sameSite: 'none',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8,
  });
  return res;
}