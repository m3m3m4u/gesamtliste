import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

/*
  Entfernt alle Vorkommen von "Kunstturnen" (inkl. Varianten mit unterschiedlicher Groß-/Kleinschreibung)
  aus den Feldern "Angebote", "Schwerpunkte", "Schwerpunkt" bei allen Schüler-Dokumenten.

  Aufruf (einmalig ausführen, z.B. in DevTools Konsole):
    fetch('/api/admin/cleanup-kunstturnen', { method: 'POST' }).then(r=>r.json()).then(console.log)

  Sicherheitsmechanik: Nur POST erlaubt; GET liefert Hinweis.
*/

const TARGET_FIELDS = ['Angebote','Schwerpunkte','Schwerpunkt'] as const;
type FieldName = typeof TARGET_FIELDS[number];

import { ObjectId } from 'mongodb';

interface StudentCleanupDoc {
  _id: ObjectId; // ObjectId des Dokuments
  Angebote?: unknown;
  Schwerpunkte?: unknown;
  Schwerpunkt?: unknown;
  [key: string]: unknown;
}

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
  const client = await clientPromise; const db = client.db(); const col = db.collection<StudentCleanupDoc>('students');

  const needle = 'kunstturnen';
  const regex = /kunstturnen/i;
  const query: { $or: Array<Record<FieldName, { $regex: RegExp }>> } = {
    $or: TARGET_FIELDS.map(f => ({ [f]: { $regex: regex } })) as Array<Record<FieldName, { $regex: RegExp }>>
  };

  const cursor = col.find(query, { projection: { _id: 1, Angebote: 1, Schwerpunkte: 1, Schwerpunkt: 1 } });
  let modified = 0;
  const bulk: Array<{ updateOne: { filter: { _id: ObjectId }; update: { $set: Record<string, unknown> } } }> = [];
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    const update: Record<string, unknown> = {};
    let changed = false;
    for (const field of TARGET_FIELDS) {
      const original = (doc as StudentCleanupDoc)[field];
      if (original === undefined) continue;
      const list = normalizeList(original);
      const filtered = list.filter(x => x.toLowerCase() !== needle);
      if (filtered.length !== list.length) {
        const rebuilt = rebuild(original, filtered);
        // Nach-Reinigung: Wenn komplett leer -> Feld entfernen statt leeres Konstrukt zu lassen
        if (Array.isArray(rebuilt) && rebuilt.length === 0) {
          update[field] = [];
        } else if (typeof rebuilt === 'string') {
          const trimmed = rebuilt.trim()
            .replace(/^[,;/+&|\s]+/, '')
            .replace(/[,;/+&|\s]+$/, '')
            .replace(/\s{2,}/g,' ');
          if (!trimmed) {
            // Leerer String -> Feld leeren (Array leere Repräsentation bevorzugen für Einheitlichkeit)
            update[field] = [];
          } else {
            update[field] = trimmed;
          }
        } else {
          update[field] = rebuilt;
        }
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
