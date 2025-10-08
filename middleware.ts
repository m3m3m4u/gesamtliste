import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const dest = req.headers.get('sec-fetch-dest');
  const accept = req.headers.get('accept') || '';
  const isHtml = accept.includes('text/html');

  // Blockiere direkten Zugriff: nur iframe-Zugriff erlaubt
  if (isHtml && dest !== 'iframe') {
    return new NextResponse('Zugriff nur über eingebettete Ansicht erlaubt.', { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/((?!_next/|api/|favicon.ico).*)'],
};
