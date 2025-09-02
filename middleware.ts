import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'site_auth';
const COOKIE_VALUE = process.env.SITE_AUTH_VERSION || '1';

const PROTECTED_PREFIXES = ['/schueler','/optionen','/api/students','/api/options'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always public: root overview and other pages; only protect listed prefixes.
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  // --- IFRAME / Einbettungs-Restriktion ---
  // Anforderung: Seite darf nur funktionieren, wenn sie als Iframe auf diler.schuleamsee.at geladen ist.
  // Umsetzung: Prüfe Sec-Fetch-Dest + Referer. Setze Cookie embed_ok bei erlaubter Iframe-Einbettung.
  // Nachfolgende Requests (API, Assets) werden nur erlaubt, wenn embed_ok vorhanden oder weiterhin ein gültiger iframe load.
  // In Development (NODE_ENV=development) deaktiviert für einfacheres Testen.
  const enforce = process.env.NODE_ENV !== 'development';
  const allowedParentHost = 'diler.schuleamsee.at';
  if (enforce) {
    const dest = req.headers.get('sec-fetch-dest'); // 'iframe', 'document', 'empty', ...
    const referer = req.headers.get('referer') || '';
    let refererHost = '';
    try { if (referer) { const u = new URL(referer); refererHost = u.host; } } catch {}
    const embedCookie = req.cookies.get('embed_ok')?.value === '1';

    // Erlaubnisfall: initialer Iframe-Abruf
    const isIframeLoad = dest === 'iframe';
    const fromAllowedParent = refererHost === allowedParentHost;

    if (isIframeLoad && fromAllowedParent) {
      // Setze Cookie für Folge-Requests
      const res = NextResponse.next();
      res.cookies.set('embed_ok', '1', { path: '/', httpOnly: false });
      return res;
    }

    // Blockiere jede Top-Level Navigation (dest=document) oder fehlende dest, wenn nicht ausdrücklich als iframe erlaubt
    if (dest === 'document' || !dest) {
      return new NextResponse('<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Blocked</title><style>body{font-family:system-ui,Arial,sans-serif;background:#f8f8f8;color:#222;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}div{max-width:480px;padding:24px;border:1px solid #ddd;background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.06);}h1{font-size:18px;margin:0 0 12px;}p{margin:4px 0;font-size:14px;line-height:1.4;}</style></head><body><div><h1>Nur eingebettet verfügbar</h1><p>Diese Anwendung kann ausschließlich eingebettet auf <strong>" + allowedParentHost + "</strong> genutzt werden.</p></div></body></html>', { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Für API / nachgelagerte Requests: nur erlauben, wenn Cookie vorhanden
    if (!embedCookie) {
      const isApi = pathname.startsWith('/api/');
      if (isApi) return NextResponse.json({ error: 'Embedding required' }, { status: 403 });
      return new NextResponse('<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Blocked</title><style>body{font-family:system-ui,Arial,sans-serif;background:#f8f8f8;color:#222;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}div{max-width:480px;padding:24px;border:1px solid #ddd;background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.06);}h1{font-size:18px;margin:0 0 12px;}p{margin:4px 0;font-size:14px;line-height:1.4;}</style></head><body><div><h1>Embedding erforderlich</h1><p>Bitte nur über <strong>" + allowedParentHost + "</strong> im Iframe aufrufen.</p></div></body></html>', { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
  }

  const needsAuth = PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!needsAuth) return NextResponse.next();

  const authed = req.cookies.get(COOKIE_NAME)?.value === COOKIE_VALUE;
  if (authed) return NextResponse.next();

  const isApi = pathname.startsWith('/api/');
  if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
