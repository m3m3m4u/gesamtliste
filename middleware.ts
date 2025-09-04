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
    if(pathname === '/login') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const authed = req.cookies.get(COOKIE_NAME)?.value === COOKIE_VALUE;
  if (authed) return NextResponse.next();

  const isApi = pathname.startsWith('/api/');
  // Wenn eingebettet (iframe) und noch keine Auth -> erst zur Übersicht statt sofort Login
  const dest = req.headers.get('sec-fetch-dest');
  if (dest === 'iframe') {
    const overviewUrl = req.nextUrl.clone();
    overviewUrl.pathname = '/';
    overviewUrl.search = '';
    return NextResponse.redirect(overviewUrl);
  }
  if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
