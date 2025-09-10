import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Ultra-lockere Logik: Standardmäßig KEIN Passwort mehr nötig (auch nicht für Mutationen).
// Setze ENV STRICT_SIMPLE_PASSWORD=1 um das frühere Verhalten (Mutationen brauchen Passwort) wieder zu aktivieren.

const SIMPLE_PASSWORD = process.env.SIMPLE_PASSWORD || '872020';
const STRICT_MODE = process.env.STRICT_SIMPLE_PASSWORD === '1';
const COOKIE_NAME = 'site_auth';
// Einfacher Wert, nicht sicherheitsrelevant
const COOKIE_VALUE = '1';

// Seiten / APIs, bei denen Mutationen nur mit Passwort erlaubt sein sollen
const PROTECTED_PAGE_PREFIXES = ['/schueler','/optionen']; // nur für Historie – GET wird jetzt freigelassen
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
  const qpNames = ['pw','auth','password','p','key','k','token'];
  for (const n of qpNames) {
    const v = url.searchParams.get(n);
    if (v) return v.trim();
  }
  // Pfad-Segment /pw-XXXX optional erlauben
  const segMatch = url.pathname.match(/\/pw-(\w+)/i);
  if (segMatch) return segMatch[1];
  // Referer Parameter extrahieren falls vorhanden
  const ref = req.headers.get('referer');
  if (ref) {
    try {
      const ru = new URL(ref);
      for (const n of qpNames) {
        const v = ru.searchParams.get(n);
        if (v) return v.trim();
      }
      // Hash (#pw=...) aus Referer
      if (ru.hash) {
        const m = ru.hash.match(/pw=([^&]+)/i);
        if (m) return decodeURIComponent(m[1]);
      }
    } catch {}
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
  // Nur mutierende API Calls brauchen Passwort – aber nur in STRICT_MODE.
  const method = req.method;
  const mutating = STRICT_MODE && isProtectedApi && isMutation(method);
  const pwFromReq = extractPw(req);
  const authed = alreadyAuthed(req) || (pwFromReq && pwFromReq === SIMPLE_PASSWORD);

  if (authed) {
    const res = NextResponse.next();
  // Cookie sehr liberal setzen plus SameSite=None für iFrames; secure nur in Prod
  res.cookies.set({ name: COOKIE_NAME, value: COOKIE_VALUE, path: '/', httpOnly: false, sameSite: 'none', secure: process.env.NODE_ENV === 'production', maxAge: 60*60*12 });
    return res;
  }
  // Mutierende API ohne Passwort -> 401 JSON, alles andere frei
  if (mutating && !authed) {
    return new NextResponse(JSON.stringify({ error: 'Passwort fehlt' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  // In nicht-striktem Modus immer erlauben.
  return NextResponse.next();
}

export const config = {
  matcher: ['/(.*)'],
};
