import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'site_auth';
const COOKIE_VALUE = process.env.SITE_AUTH_VERSION || '1';

const PROTECTED_PREFIXES = ['/schueler','/optionen','/api/students','/api/options'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always public: root overview and other pages; only protect listed prefixes.
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next(); // Nur rein technische Assets weiterhin freigeben
  }

  // Embed-Restriktionen vollständig entfernt (ehemalige Token-Prüfung gelöscht)

  // TEMP: Auth deaktiviert
  const needsAuth = false;
  if (!needsAuth) {
    return NextResponse.next();
  }

  // (alter Auth-Code entfernt)
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
