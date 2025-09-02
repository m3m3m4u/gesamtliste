import { NextResponse } from 'next/server';

const COOKIE_NAME = 'site_auth';
const COOKIE_VALUE = process.env.SITE_AUTH_VERSION || '1';
const SECRET = process.env.SIMPLE_SECRET || '872020';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pw = String(body?.password ?? '');
    if (pw !== SECRET) {
      return NextResponse.json({ ok: false, error: 'Falsches Passwort' }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    // Always set SameSite=None to ensure cookie works inside cross-site iframe without needing FORCE_IFRAME env.
    // Security: Middleware already restricts top-level usage / embedding host.
    res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
      httpOnly: true,
      sameSite: 'none',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: 'Fehler' }, { status: 500 });
  }
}
