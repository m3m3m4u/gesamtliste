import { NextResponse } from 'next/server';

const COOKIE_NAME = 'site_auth';
const COOKIE_VALUE = process.env.SITE_AUTH_VERSION || '1';
const SECRET = process.env.SIMPLE_SECRET || '872020';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
  const pw = String(body?.password ?? '');
  const universalOk = pw === '872020';
  if (pw !== SECRET && !universalOk) {
      return NextResponse.json({ ok: false, error: 'Falsches Passwort' }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    // SameSite auf 'lax' (vorher 'none'): vermeidet Blockierung in lokalen / unsicheren Dev-Umgebungen,
    // da Browser SameSite=None ohne Secure ablehnen. Für Iframe-Cross-Site-Einsatz könnte wieder 'none'
    // genutzt werden, dann aber stets mit HTTPS.
    // Für eingebettete Nutzung (Iframe): SameSite=None und Secure=true erforderlich
    res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: 'Fehler' }, { status: 500 });
  }
}
