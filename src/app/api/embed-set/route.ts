import { NextResponse } from 'next/server';
import { EMBED_COOKIE_NAME } from '@/lib/embedGuard';

export async function POST() {
  // Leichtgewicht: Client ruft diese Route im Iframe auf, um Cookie zu setzen.
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