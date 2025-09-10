import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Ultra-einfache Schutz-Logik: Passwort 872020 darf immer per Query/Header/Cookie übergeben werden.
// Ziel: Versehentliche Änderungen verhindern – kein echter Sicherheitsanspruch.

const SIMPLE_PASSWORD = process.env.SIMPLE_PASSWORD || '872020';
const COOKIE_NAME = 'site_auth';
// Einfacher Wert, nicht sicherheitsrelevant
const COOKIE_VALUE = '1';

// Seiten / APIs, bei denen Mutationen nur mit Passwort erlaubt sein sollen
const PROTECTED_PAGE_PREFIXES = ['/schueler','/optionen'];
const PROTECTED_API_PREFIXES = ['/api/students','/api/options'];

function hasProtectedPage(pathname: string){
  return PROTECTED_PAGE_PREFIXES.some(p=> pathname.startsWith(p));
}
function hasProtectedApi(pathname: string){
  return PROTECTED_API_PREFIXES.some(p=> pathname.startsWith(p));
}

function isMutation(method: string){
  return !['GET','HEAD','OPTIONS'].includes(method.toUpperCase());
}

function extractPw(req: NextRequest): string | null {
  const url = req.nextUrl;
  const qpNames = ['pw','auth','password','p'];
  for (const n of qpNames) {
    const v = url.searchParams.get(n);
    if (v) return v.trim();
  }
  const headers = req.headers;
  const hCandidates = [headers.get('x-auth'), headers.get('x-password')];
  for (const h of hCandidates) { if (h) return h.trim(); }
  const authHeader = headers.get('authorization');
  if (authHeader) {
    // Akzeptiere direktes Passwort oder z.B. "Bearer 872020" / "Basic 872020"
    const parts = authHeader.split(/[\s]+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    if (parts.length >= 2) return parts[1];
  }
  return null;
}

function alreadyAuthed(req: NextRequest): boolean {
  const cookieVal = req.cookies.get(COOKIE_NAME)?.value;
  if (cookieVal === COOKIE_VALUE) return true;
  // LocalStorage kann Middleware nicht sehen – client-seitig wird bei Query-Passwort eine Cookie-Setzung ausgelöst
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Statische/öffentliche Dateien immer durchlassen
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  const isProtectedPage = hasProtectedPage(pathname);
  const isProtectedApi = hasProtectedApi(pathname);
  const needsAuth = isProtectedPage || isProtectedApi;

  if (!needsAuth) {
    return NextResponse.next();
  }

  const method = req.method;
  const mutating = isProtectedApi && isMutation(method);
  const pwFromReq = extractPw(req);
  const authed = alreadyAuthed(req) || (pwFromReq && pwFromReq === SIMPLE_PASSWORD);

  if (authed) {
    const res = NextResponse.next();
    // Cookie sehr liberal setzen (kein Secure/SameSite) damit auch in eingebetteten Kontexten eher akzeptiert wird
    res.cookies.set({ name: COOKIE_NAME, value: COOKIE_VALUE, path: '/', httpOnly: false });
    return res;
  }

  // Falls Passwort in Query NICHT vorhanden aber wir nur eine Seite anzeigen wollen, einfach simple HTML-Antwort anstatt harter Redirect
  if (isProtectedPage && !pwFromReq) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Passwort</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="font-family:system-ui;max-width:480px;margin:40px auto;padding:16px;line-height:1.4">
      <h1 style="font-size:18px;margin:0 0 16px">Passwort erforderlich</h1>
      <form method="GET" style="display:flex;gap:8px;flex-direction:column">
        <input name="pw" autofocus placeholder="Passwort" style="padding:8px;border:1px solid #888;border-radius:4px" />
        <button style="padding:10px 14px;background:#2563eb;color:#fff;border:0;border-radius:4px;cursor:pointer">Weiter</button>
      </form>
      <p style="font-size:12px;color:#555;margin-top:24px">Tipp: URL mit <code>?pw=${SIMPLE_PASSWORD}</code> einbetten, damit iFrames ohne Interaktion funktionieren.</p>
      <script>
      // Hash-Fallback (#pw=872020) -> in Query umschreiben
      (function(){
        if(location.hash && location.hash.length>1){
          const m=location.hash.match(/pw=([^&]+)/i); if(m){
            const u=new URL(location.href); u.searchParams.set('pw', m[1]); u.hash=''; location.replace(u.toString());
          }
        }
      })();
      </script>
    </body></html>`;
    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // Mutierende API ohne Passwort -> 401 JSON
  if (mutating && !authed) {
    return new NextResponse(JSON.stringify({ error: 'Passwort fehlt' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // Nicht mutierende API-GET ohne Passwort erlauben (rein lesend)
  if (isProtectedApi && !mutating) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/(.*)'],
};
