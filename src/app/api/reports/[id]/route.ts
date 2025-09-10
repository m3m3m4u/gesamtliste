import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function PATCH(req: Request, context: unknown) {
  const { params } = context as { params: { id: string } };
  const id = params.id;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const body = await req.json().catch(() => ({} as { status?: string }));
  const raw = body.status;
  const status: 'offen' | 'erledigt' | undefined = raw === 'erledigt' ? 'erledigt' : raw === 'offen' ? 'offen' : undefined;
  if (!status) return NextResponse.json({ error: 'Status ungültig' }, { status: 400 });
  const client = await clientPromise; const db = client.db(); const col = db.collection('reports');
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { status, updatedAt: new Date().toISOString() } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, context: unknown) {
  const { params } = context as { params: { id: string } };
  const id = params.id;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const client = await clientPromise; const db = client.db(); const col = db.collection('reports');
  await col.deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ ok: true });
}