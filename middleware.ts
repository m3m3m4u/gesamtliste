import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const referer = req.headers.get('referer') || '';
  const dest = req.headers.get('sec-fetch-dest');
  const secFetchSite = req.headers.get('sec-fetch-site');
  const accept = req.headers.get('accept') || '';
  const isHtml = accept.includes('text/html');

  // Erlaubte Domains für Iframe-Einbettung
  const allowedDomains = ['diler.schuleamsee.at', 'localhost'];
  
  // Prüfe ob Zugriff aus erlaubtem Referer kommt
  const hasValidReferer = allowedDomains.some(domain => referer.includes(domain));

  // Blockiere direkten Zugriff auf HTML-Seiten
  if (isHtml) {
    // Fall 1: sec-fetch-dest ist gesetzt und NICHT iframe
    if (dest && dest !== 'iframe') {
      return new NextResponse('Zugriff nur über eingebettete Ansicht erlaubt.', { status: 403 });
    }
    
    // Fall 2: sec-fetch-site ist 'none' (direkter Browser-Zugriff) ohne validen Referer
    if (secFetchSite === 'none' && !hasValidReferer) {
      return new NextResponse('Zugriff nur über eingebettete Ansicht erlaubt.', { status: 403 });
    }
    
    // Fall 3: Kein sec-fetch-dest Header und kein valider Referer (ältere Browser)
    if (!dest && !hasValidReferer && secFetchSite !== 'same-origin') {
      return new NextResponse('Zugriff nur über eingebettete Ansicht erlaubt.', { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/((?!_next/|api/|favicon.ico).*)'],
};
