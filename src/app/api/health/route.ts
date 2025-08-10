import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const start = Date.now();
    const client = await clientPromise;
    const db = client.db();
    const col = db.collection('students');
    const count = await col.estimatedDocumentCount();
    const ping = await db.command({ ping: 1 });
    return NextResponse.json({ ok: true, db: db.databaseName, count, ping: ping.ok === 1, ms: Date.now() - start });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler' }, { status: 500 });
  }
}
