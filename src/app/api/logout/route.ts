import { NextResponse } from 'next/server';

const COOKIE_NAME = 'site_auth';

export async function POST() {
  // Nach dem Ausloggen zurück zur öffentlichen Übersicht (/)
  const res = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
