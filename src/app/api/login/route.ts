import { NextResponse } from 'next/server';

const COOKIE_NAME = 'site_auth';
const SECRET = process.env.SIMPLE_SECRET || '872020';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pw = String(body?.password ?? '');
    if (pw !== SECRET) {
      return NextResponse.json({ ok: false, error: 'Falsches Passwort' }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // 12 Stunden gültig
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: 'Fehler' }, { status: 500 });
  }
}
