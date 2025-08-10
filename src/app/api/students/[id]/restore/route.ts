import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// POST /api/students/:id/restore  (Wiederherstellen)
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id || !ObjectId.isValid(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('students');
  const now = new Date().toISOString();
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { _deleted: false, updatedAt: now }, $unset: { deletedAt: '' } },
    { returnDocument: 'after' }
  );
  if (!result) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
  return NextResponse.json(result);
}
