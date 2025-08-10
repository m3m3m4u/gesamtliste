import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET /api/students
// Unterstützt Parameter: q (bevorzugt) oder search
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get('q') || searchParams.get('search') || '').trim();
  const klasse = (searchParams.get('klasse') || '').trim();
  const angebot = (searchParams.get('angebot') || '').trim();
  const onlyNames = searchParams.has('onlyNames');
  const schwerpunkt = (searchParams.get('schwerpunkt') || '').trim();
  const fields = (searchParams.get('fields') || '').trim(); // Kommagetrennte Feldliste
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
  const skip = Number(searchParams.get('skip') || 0);
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('students');
  let filter: any = {};
  if (raw) {
    // Split nach Leerzeichen für einfache UND-Suche (alle Tokens müssen matchen)
    const tokens = raw.split(/\s+/).filter(Boolean);
    const makeRegex = (t: string) => ({ $regex: t, $options: 'i' });
    const fieldNames = onlyNames ? ['Vorname','Familienname'] : ['Vorname','Familienname','Benutzername'];
    filter = {
      $and: tokens.map(t => ({
        $or: fieldNames.map(fn => ({ [fn]: makeRegex(t) }))
      }))
    };
  }
  if (klasse) {
    // Klasse kann in mehreren Feldern vorkommen -> wir prüfen gängige Feldnamen
    const klasseFilter = {
      $or: [
        { Klasse: klasse },
        { 'Klasse 25/26': klasse },
        { Klasse25: klasse },
        { Klasse26: klasse }
      ]
    };
    filter = Object.keys(filter).length ? { $and: [filter, klasseFilter] } : klasseFilter;
  }
  if (angebot) {
    // Exakte (case-insensitive) Übereinstimmung eines Array-Elements in Angebote
    const escaped = angebot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const angebotFilter = { Angebote: { $regex: `^${escaped}$`, $options: 'i' } };
    filter = Object.keys(filter).length ? { $and: [filter, angebotFilter] } : angebotFilter;
  }
  if (schwerpunkt) {
    // Exakte (case-insensitive) Übereinstimmung in Schwerpunkte (Array oder String) oder Schwerpunkt (Singular)
    const escaped = schwerpunkt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const schwerpunktFilter = {
      $or: [
        { Schwerpunkte: { $regex: `(^|[,;/\s])${escaped}([,;/\s]|$)`, $options: 'i' } },
        { Schwerpunkt: { $regex: `(^|[,;/\s])${escaped}([,;/\s]|$)`, $options: 'i' } },
        { 'Schwerpunkt 1': { $regex: `(^|[,;/\s])${escaped}([,;/\s]|$)`, $options: 'i' } }
      ]
    };
    filter = Object.keys(filter).length ? { $and: [filter, schwerpunktFilter] } : schwerpunktFilter;
  }
  const projection: any = {};
  if (fields) {
    for (const f of fields.split(',').map(s=>s.trim()).filter(Boolean)) projection[f] = 1;
  }
  const total = await col.countDocuments(filter);
  const cursor = col.find(filter, Object.keys(projection).length ? { projection } : undefined)
    .skip(skip)
    .limit(limit)
    .sort({ Familienname: 1, Vorname: 1 })
  const docs = await cursor.toArray();
  return NextResponse.json({ total, items: docs });
}
