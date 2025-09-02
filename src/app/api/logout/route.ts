import { NextResponse } from 'next/server';

const COOKIE_NAME = 'site_auth';

export async function POST() {
  // Cookie löschen, aber kein Redirect (Iframe bleibt stabil)
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
