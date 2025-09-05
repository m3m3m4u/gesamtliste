import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Geschützte Pfade
const PROTECTED_PREFIXES = ['/schueler', '/optionen', '/meldungen'];
const COOKIE_NAME = 'site_auth';
const COOKIE_VALUE = process.env.SITE_AUTH_VERSION || '1';
const SECRET = process.env.SIMPLE_SECRET || '872020';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Bereits auf /login lassen
  if (pathname.startsWith('/login') || pathname.startsWith('/api/login')) return NextResponse.next();
  const needsAuth = PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!needsAuth) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie === COOKIE_VALUE) return NextResponse.next();
  // Fallback: auth/pw Query Parameter erlaubt passwortlosen (param-basierten) Zugriff wenn Cookie geblockt
  const qpPw = req.nextUrl.searchParams.get('auth') || req.nextUrl.searchParams.get('pw');
  if (qpPw && (qpPw === SECRET || qpPw === '872020')) {
    const res = NextResponse.next();
    // Versuche Cookie zu setzen (wird evtl. als Third-Party geblockt, aber schadet nicht)
    try {
      // Partitioned (CHIPS) für moderne Browser, SameSite=None für Iframe Cross-Site
      res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        path: '/',
        maxAge: 60 * 60 * 12,
  // Partitioned (CHIPS) entfernt wegen Lint; kann bei Bedarf wieder aktiviert werden
      });
    } catch {}
    return res;
  }
  // Referer-Fallback: Falls Cookie fehlt, aber Einbettung von Seite kommt, deren URL den auth Parameter enthält
  const referer = req.headers.get('referer') || '';
  if (referer.includes('auth=872020') || referer.includes(`auth=${SECRET}`) || referer.includes(`pw=${SECRET}`)) {
    return NextResponse.next();
  }

  // Redirect zu /login mit next Param
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname + (req.nextUrl.search || ''));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/schueler/:path*','/optionen/:path*','/meldungen/:path*']
};
