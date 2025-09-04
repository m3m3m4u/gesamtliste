import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Geschützte Pfade
const PROTECTED_PREFIXES = ['/schueler', '/optionen', '/meldungen'];
const COOKIE_NAME = 'site_auth';
const COOKIE_VALUE = process.env.SITE_AUTH_VERSION || '1';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Bereits auf /login lassen
  if (pathname.startsWith('/login') || pathname.startsWith('/api/login')) return NextResponse.next();
  const needsAuth = PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!needsAuth) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie === COOKIE_VALUE) return NextResponse.next();

  // Redirect zu /login mit next Param
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname + (req.nextUrl.search || ''));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/schueler/:path*','/optionen/:path*','/meldungen/:path*']
};
