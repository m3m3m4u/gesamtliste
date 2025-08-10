import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

// PATCH /api/students/:id
// Next.js RouteContext erwartet params u.U. als Promise
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
  }
  const body: Record<string, unknown> = await request.json();
  delete body._id;
  delete body.createdAt;
  // updatedAt setzen
  body.updatedAt = new Date().toISOString();
  // Klartext Passwort -> Hash
  if (typeof body.Passwort === 'string' && (body.Passwort as string).trim()) {
    try {
      const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
      body.PasswortHash = bcrypt.hashSync((body.Passwort as string).trim(), saltRounds);
    } catch {}
  } else {
    delete body.Passwort; // kein Update falls leer
  }
  // Geburtsdatum normalisieren auf YYYY-MM-DD falls Datum
  if (typeof body.Geburtsdatum === 'string' && (body.Geburtsdatum as string).length >= 10) {
    body.Geburtsdatum = (body.Geburtsdatum as string).slice(0,10);
  }
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('students');
  const result = await col.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: body }, { returnDocument: 'after' });
  if (!result) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
  return NextResponse.json(result);
}

// DELETE /api/students/:id  (Softdelete)
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id || !ObjectId.isValid(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('students');
  const now = new Date().toISOString();
  const result = await col.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: { _deleted: true, deletedAt: now, updatedAt: now } }, { returnDocument: 'after' });
  if (!result) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
  return NextResponse.json(result);
}

// Restore-POST ist nun in eigener Route /api/students/[id]/restore
