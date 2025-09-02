import { NextResponse } from 'next/server';
import { hasEmbedCookie } from '@/lib/embedGuard';

export async function GET() {
  const ok = await hasEmbedCookie();
  return NextResponse.json({ embedded: ok, require: process.env.REQUIRE_EMBED === '1' });
}
