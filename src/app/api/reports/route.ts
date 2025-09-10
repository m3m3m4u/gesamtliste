import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(_req: Request) {
  const client = await clientPromise; const db = client.db(); const col = db.collection('reports');
  const items = await col.find({}, { projection: { _id: 1, text: 1, status: 1, createdAt: 1, updatedAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();
  return NextResponse.json({ items });
}

type ReportDoc = { text: string; status: 'offen' | 'erledigt'; createdAt: string; updatedAt: string };
type ReportBody = { text?: unknown };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({} as ReportBody))) as ReportBody;
    const text = String(body.text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'Text fehlt' }, { status: 400 });
    const client = await clientPromise; const db = client.db(); const col = db.collection('reports');
    const now = new Date().toISOString();
    const doc: ReportDoc = { text, status: 'offen', createdAt: now, updatedAt: now };
    const ins = await col.insertOne(doc);
    return NextResponse.json({ ok: true, id: ins.insertedId });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}