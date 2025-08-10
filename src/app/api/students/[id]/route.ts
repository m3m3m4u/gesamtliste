import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

// PATCH /api/students/:id
export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
  }
  const body = await _request.json();
  delete body._id;
  // Klartext Passwort -> Hash
  if (typeof body.Passwort === 'string' && body.Passwort.trim()) {
    try {
      const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
      body.PasswortHash = bcrypt.hashSync(body.Passwort.trim(), saltRounds);
    } catch {}
  } else {
    delete body.Passwort; // kein Update falls leer
  }
  // Geburtsdatum normalisieren auf YYYY-MM-DD falls Datum
  if (typeof body.Geburtsdatum === 'string' && body.Geburtsdatum.length >= 10) {
    body.Geburtsdatum = body.Geburtsdatum.slice(0,10);
  }
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('students');
  const result = await col.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: body }, { returnDocument: 'after' });
  if (!result) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
  return NextResponse.json(result);
}
