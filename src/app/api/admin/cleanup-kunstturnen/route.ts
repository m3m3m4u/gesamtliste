import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

/*
  Entfernt alle Vorkommen von "Kunstturnen" (inkl. Varianten mit unterschiedlicher Groß-/Kleinschreibung)
  aus den Feldern "Angebote", "Schwerpunkte", "Schwerpunkt" bei allen Schüler-Dokumenten.

  Aufruf (einmalig ausführen, z.B. in DevTools Konsole):
    fetch('/api/admin/cleanup-kunstturnen', { method: 'POST' }).then(r=>r.json()).then(console.log)

  Sicherheitsmechanik: Nur POST erlaubt; GET liefert Hinweis.
*/

const TARGET_FIELDS: Array<'Angebote' | 'Schwerpunkte' | 'Schwerpunkt'> = ['Angebote','Schwerpunkte','Schwerpunkt'];

function normalizeList(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(v=>String(v).trim()).filter(Boolean);
  if (val == null) return [];
  const s = String(val).trim();
  if (!s) return [];
  return s.split(/[,;/\n\r\t+&|]+/).map(x=>x.trim()).filter(Boolean);
}

function rebuild(original: unknown, filtered: string[]): unknown {
  if (Array.isArray(original)) return filtered; // bleib bei Array
  return filtered.join(', '); // sonst String-Variante
}

export async function GET() {
  return NextResponse.json({ info: 'Nur POST. Entfernt alle Vorkommen von "Kunstturnen" aus Schülerdaten.' }, { status: 400 });
}

export async function POST() {
  const client = await clientPromise; const db = client.db(); const col = db.collection('students');

  const needle = 'kunstturnen';
  const query = {
    $or: TARGET_FIELDS.map(f => ({ [f]: { $regex: /kunstturnen/i } }))
  } as any;

  const cursor = col.find(query, { projection: { _id: 1, Angebote: 1, Schwerpunkte: 1, Schwerpunkt: 1 } });
  let modified = 0;
  const bulk: any[] = [];
  while (await cursor.hasNext()) {
    const doc: any = await cursor.next();
    const update: Record<string, unknown> = {};
    let changed = false;
    for (const field of TARGET_FIELDS) {
      const original = doc[field];
      if (original === undefined) continue;
      const list = normalizeList(original);
      const filtered = list.filter(x => x.toLowerCase() !== needle);
      if (filtered.length !== list.length) {
        update[field] = rebuild(original, filtered);
        changed = true;
      }
    }
    if (changed) {
      bulk.push({ updateOne: { filter: { _id: doc._id }, update: { $set: update } } });
      modified++;
    }
  }
  if (bulk.length) await col.bulkWrite(bulk);
  return NextResponse.json({ ok: true, modified });
}
