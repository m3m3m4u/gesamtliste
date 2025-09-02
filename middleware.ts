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

  // --- IFRAME / Einbettungs-Restriktion ---
  // Anforderung: Seite darf nur funktionieren, wenn sie als Iframe auf diler.schuleamsee.at geladen ist.
  // Umsetzung: Prüfe Sec-Fetch-Dest + Referer. Setze Cookie embed_ok bei erlaubter Iframe-Einbettung.
  // Nachfolgende Requests (API, Assets) werden nur erlaubt, wenn embed_ok vorhanden oder weiterhin ein gültiger iframe load.
  // In Development (NODE_ENV=development) deaktiviert für einfacheres Testen.
  // Immer erzwingen (auch in Development), damit lokal das gleiche Verhalten geprüft werden kann.
  const enforce = true;
  const allowedParentHost = 'diler.schuleamsee.at';
  if (enforce) {
    const dest = req.headers.get('sec-fetch-dest') || '';
    const referer = req.headers.get('referer') || '';
    let refererHost = '';
    try { if (referer) { const u = new URL(referer); refererHost = u.host; } } catch {}
    const embedCookie = req.cookies.get('embed_ok')?.value === '1';
    const isIframeLoad = dest === 'iframe';
    const fromAllowedParent = refererHost === allowedParentHost;

    if (isIframeLoad && fromAllowedParent) {
      const res = NextResponse.next();
      res.cookies.set('embed_ok', '1', {
        path: '/', httpOnly: true, sameSite: 'none', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 8,
      });
      res.headers.set('X-Embed-Debug', `grant iframe referer=${refererHost}`);
      return res;
    }
    const isApi = pathname.startsWith('/api/');
    const isDocument = dest === 'document' || dest === '';
    // Top-Level Aufrufe immer blocken
    if (isDocument) {
      const html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Blocked</title><style>body{font-family:system-ui,Arial,sans-serif;background:#f8f8f8;color:#222;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}div{max-width:520px;padding:24px;border:1px solid #ddd;background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.06);}h1{font-size:18px;margin:0 0 12px;}code{background:#eee;padding:2px 4px;border-radius:4px;}p{margin:6px 0;font-size:14px;line-height:1.45;}</style></head><body><div><h1>Direkter Zugriff blockiert</h1><p>Nur eingebettet über <strong>'+allowedParentHost+'</strong> erlaubt.</p><p>Debug: dest=<code>'+dest+'</code> refererHost=<code>'+refererHost+'</code> cookie='+embedCookie+'</p></div></body></html>';
      return new NextResponse(html, { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Embed-Debug': `block document dest=${dest} referer=${refererHost}` } });
    }
    // Nicht-Document (z.B. fetch von außen) nur erlauben, wenn iframe vorher Cookie gesetzt hat
    if (!embedCookie) {
      if (isApi) return NextResponse.json({ error: 'Embedding required', detail: { dest, refererHost, cookie: false } }, { status: 403 });
      return new NextResponse('Forbidden', { status: 403, headers: { 'X-Embed-Debug': `block no-cookie non-doc dest=${dest} referer=${refererHost}` } });
    }
  }

  const needsAuth = PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!needsAuth) return NextResponse.next();

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
