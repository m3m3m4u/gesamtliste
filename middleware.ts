import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Pass-Through Middleware (QuizGate übernimmt symbolische Schranke clientseitig)

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next).*)'] };
