import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const referer = req.headers.get('referer') || '';
  const dest = req.headers.get('sec-fetch-dest');
  const secFetchSite = req.headers.get('sec-fetch-site');
  const secFetchMode = req.headers.get('sec-fetch-mode');
  const accept = req.headers.get('accept') || '';
  const isHtml = accept.includes('text/html');

  // Nur in Production blockieren (Vercel setzt NODE_ENV automatisch)
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Erlaubte Domain für Iframe-Einbettung
  const allowedDomain = 'diler.schuleamsee.at';
  
  // Prüfe ob Zugriff aus erlaubtem Referer kommt
  const hasValidReferer = referer.includes(allowedDomain);

  // Blockiere direkten Zugriff auf HTML-Seiten (nur in Production)
  if (isHtml && isProduction) {
    // STRIKTE Logik: Standardmäßig blockieren, nur explizit erlauben
    
    // Erlaubte Fälle:
    // 1. Iframe von erlaubter Domain (Referer-Check)
    if (hasValidReferer) {
      return NextResponse.next();
    }
    
    // 2. Expliziter Iframe-Request (sec-fetch-dest)
    if (dest === 'iframe') {
      return NextResponse.next();
    }
    
    // 3. Nested Navigation (innerhalb Iframe)
    if (secFetchMode === 'nested-navigate') {
      return NextResponse.next();
    }
    
    // 4. Same-Origin Navigation (Links innerhalb der App, nur wenn bereits im Iframe)
    if (secFetchSite === 'same-origin' && secFetchMode === 'navigate') {
      // Zusätzlich prüfen: Ist es wirklich ein Iframe-Context?
      // Wenn kein Referer UND same-origin → wahrscheinlich direkter Tab-Zugriff
      if (!referer) {
        // Blockieren: Same-origin ohne Referer = neuer Tab
        return new NextResponse(
          `<!DOCTYPE html>
<html>
<head><title>Zugriff eingeschränkt</title></head>
<body style="font-family: system-ui; padding: 2rem; max-width: 600px; margin: 0 auto;">
  <h1>⛔ Zugriff eingeschränkt</h1>
  <p>Diese Anwendung ist nur über die offizielle Website zugänglich.</p>
  <p>Bitte besuchen Sie: <a href="https://diler.schuleamsee.at">diler.schuleamsee.at</a></p>
</body>
</html>`,
          { 
            status: 403,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      }
      return NextResponse.next();
    }
    
    // ALLE anderen Fälle: BLOCKIEREN
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head><title>Zugriff eingeschränkt</title></head>
<body style="font-family: system-ui; padding: 2rem; max-width: 600px; margin: 0 auto;">
  <h1>⛔ Zugriff eingeschränkt</h1>
  <p>Diese Anwendung ist nur über die offizielle Website zugänglich.</p>
  <p>Bitte besuchen Sie: <a href="https://diler.schuleamsee.at">diler.schuleamsee.at</a></p>
</body>
</html>`,
      { 
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/((?!_next/|api/|favicon.ico).*)'],
};
