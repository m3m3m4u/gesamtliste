import { NextResponse } from 'next/server';

const COOKIE_NAME = 'site_auth';

// WICHTIG: Das Login setzt SameSite=None. Zum Löschen muss dasselbe Attribut verwendet werden,
// damit der Browser das gleiche Cookie überschreibt. Sonst bleibt das alte (None) Cookie bestehen
// und der Nutzer bleibt eingeloggt.
export async function POST(request: Request) {
  const url = new URL('/', request.url);
  const res = NextResponse.redirect(url, 303); // 303 damit ein GET auf / folgt und Server neu rendert
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
