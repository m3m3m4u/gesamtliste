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

  // --- IFRAME / Einbettungs-Restriktion (Token-basiert) ---
  // Vereinfachtes Modell: Seite nur nutzbar, wenn zuvor ein gültiger Einbettungs-Token (?embed=TOKEN) gesetzt hat.
  // 1. EMBED_TOKEN (Environment) definieren.
  // 2. Iframe-Src: https://gesamtliste.vercel.app/?embed=TOKEN
  // 3. Middleware setzt Cookie embed_ok, danach alle Folge-Requests erlaubt.
  // 4. Direkter Aufruf ohne Cookie & ohne Token -> 403.
  const enforce = true;
  const allowedToken = process.env.EMBED_TOKEN;
  if (enforce) {
    const token = req.nextUrl.searchParams.get('embed') || req.nextUrl.searchParams.get('t');
    const embedCookie = req.cookies.get('embed_ok')?.value === '1';
    const isApi = pathname.startsWith('/api/');

    if (!embedCookie) {
      if (allowedToken && token && token === allowedToken) {
        const res = NextResponse.next();
        res.cookies.set('embed_ok', '1', { path: '/', httpOnly: true, sameSite: 'none', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 8 });
        res.headers.set('X-Embed-Debug', 'grant token');
        return res;
      }
      if (isApi) return NextResponse.json({ error: 'Embedding required', detail: { tokenPresent: !!token } }, { status: 403 });
      return new NextResponse('<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Blocked</title><style>body{font-family:system-ui,Arial,sans-serif;background:#fafafa;color:#222;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}div{max-width:520px;padding:24px;border:1px solid #ddd;background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.04);}h1{font-size:18px;margin:0 0 12px;}code{background:#eee;padding:2px 4px;border-radius:4px;}p{margin:6px 0;font-size:14px;line-height:1.45;}</style></head><body><div><h1>Zugriff blockiert</h1><p>Diese Anwendung ist nur über einen gültigen Einbettungs-Token nutzbar.</p><p>Parameter z.B.: <code>?embed=TOKEN</code></p><p>Debug: token=' + (token? 'übergeben' : 'fehlt') + '</p></div></body></html>', { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Embed-Debug': `block token=${token||'none'}` } });
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
