import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Verbotene Begriffe, die nie in Angeboten/Schwerpunkten vorkommen dürfen
const FORBIDDEN_TERMS = ['kunstturnen', 'sportakademie kunstturnen'];
function isForbidden(term: string): boolean {
  const lower = term.toLowerCase().trim();
  return FORBIDDEN_TERMS.some(f => lower === f || lower.includes('kunstturnen'));
}

// Filtert verbotene Begriffe aus einem Array
function filterForbiddenFromArray(arr: unknown): unknown {
  if (!Array.isArray(arr)) return arr;
  return arr.filter(x => !isForbidden(String(x ?? '')));
}

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
  
  // Verbotene Begriffe aus Angeboten und Schwerpunkten filtern
  if (body.Angebote !== undefined) {
    body.Angebote = filterForbiddenFromArray(body.Angebote);
  }
  if (body.Schwerpunkte !== undefined) {
    body.Schwerpunkte = filterForbiddenFromArray(body.Schwerpunkte);
  }
  if (body.Schwerpunkt !== undefined) {
    if (typeof body.Schwerpunkt === 'string' && isForbidden(body.Schwerpunkt)) {
      body.Schwerpunkt = '';
    } else if (Array.isArray(body.Schwerpunkt)) {
      body.Schwerpunkt = filterForbiddenFromArray(body.Schwerpunkt);
    }
  }
  
  // Klasse-Feld-Synchronisierung: wenn 'Klasse 25/26' geändert wird, auch kanonisches Feld '25/26' setzen
  if (Object.prototype.hasOwnProperty.call(body, 'Klasse 25/26')) {
    const rawK = body['Klasse 25/26'];
    const normK = typeof rawK === 'string' ? rawK.trim() : (rawK == null ? '' : String(rawK));
    if (normK) {
      body['Klasse 25/26'] = normK;
      body['25/26'] = normK; // Kanonisch
    } else {
      // Leeren: beide Felder leeren
      body['Klasse 25/26'] = '';
      body['25/26'] = '';
    }
  }
  // updatedAt setzen
  body.updatedAt = new Date().toISOString();
  // Passwort jetzt nur im Klartext speichern; kein Hash mehr
  if (typeof body.Passwort === 'string') {
    if (!(body.Passwort as string).trim()) {
      delete body.Passwort; // leere Eingabe ignorieren
    }
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
