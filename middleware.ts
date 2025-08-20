import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SECRET = process.env.SIMPLE_SECRET || '872020';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  // Nur schützen: /schueler und /schueler/* api nicht betroffen
  if (url.pathname.startsWith('/schueler')) {
    const auth = req.headers.get('authorization') || '';
    if (auth.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString('utf8');
        // Expect format user:pass (we ignore user)
        const parts = decoded.split(':');
        const pass = parts.slice(1).join(':');
        if (pass === SECRET) return NextResponse.next();
      } catch {}
    }
    // Challenge
    const res = new NextResponse('Authentication required', { status: 401 });
    res.headers.set('WWW-Authenticate', 'Basic realm="Schueler"');
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/schueler/:path*']
};
