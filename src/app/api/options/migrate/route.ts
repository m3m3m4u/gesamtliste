import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

type Category = 'angebote'|'schwerpunkte'|'fruehbetreuung'|'status'|'religionen'|'klassen'|'sprachen';

// Mapping von Kategorie zu betroffenen Schülerfeldern
const CAT_FIELDS: Record<Category, string[]> = {
  angebote: ['Angebote'],
  schwerpunkte: ['Schwerpunkte','Schwerpunkt','Schwerpunkt 1'],
  fruehbetreuung: ['Frühbetreuung'],
  status: ['Status'],
  religionen: ['Religion'],
  klassen: ['Klasse 25/26','25/26'],
  sprachen: ['Muttersprache'],
};

function normalize(v: unknown){ return String(v ?? '').trim(); }

export async function POST(req: Request){
  try {
    const { category, oldValue, newValue } = await req.json() as { category: Category; oldValue: string; newValue: string };
    const cat = category as Category;
    if(!cat || !oldValue || !newValue) return NextResponse.json({ error: 'category, oldValue, newValue erforderlich' }, { status: 400 });
    const oldV = normalize(oldValue); const newV = normalize(newValue);
    if(!oldV || !newV) return NextResponse.json({ error: 'Leere Werte sind nicht erlaubt' }, { status: 400 });
    const fields = CAT_FIELDS[cat]; if(!fields) return NextResponse.json({ error: 'Unbekannte Kategorie' }, { status: 400 });

    const client = await clientPromise; const db = client.db(); const col = db.collection('students');
    const baseFilter = { _deleted: { $ne: true } } as Record<string, unknown>;
    const splitter = /[,;/\n\r\t]+/;

    // Migration je Feld: Strings und Arrays behandeln
    let modifiedCount = 0;
    for (const f of fields) {
      // Kandidaten finden, die oldV enthalten könnten
      const candidates = await col.find({ ...baseFilter, [f]: { $exists: true } }, { projection: { _id: 1, [f]: 1 } }).toArray();
      const bulk = col.initializeUnorderedBulkOp();
      let hasOps = false;
      for (const doc of candidates) {
        const val = (doc as Record<string, unknown>)[f];
        let changed = false; let newVal: unknown = val;
        if (Array.isArray(val)) {
          const set = new Set<string>();
          for (const v of val) {
            const s = normalize(v);
            if(!s) continue;
            if (s === oldV) { set.add(newV); changed = true; } else set.add(s);
          }
          newVal = Array.from(set);
        } else if (typeof val === 'string') {
          const s = val.trim();
          if (!s) continue;
          if (splitter.test(s)) {
            const set = new Set<string>();
            for (const part of s.split(splitter)) {
              const p = part.trim();
              if(!p) continue;
              if (p === oldV) { set.add(newV); changed = true; } else set.add(p);
            }
            newVal = Array.from(set);
          } else if (s === oldV) { newVal = newV; changed = true; }
        }
        if (changed) { bulk.find({ _id: (doc as Record<string, unknown>)._id }).updateOne({ $set: { [f]: newVal } }); hasOps = true; modifiedCount++; }
      }
      if (hasOps) await bulk.execute();
    }

    // Optionen-Dokument selbst aktualisieren (alte Bezeichnung durch neue ersetzen)
    try {
  const cfgCol = db.collection('config');
  const doc = await cfgCol.findOne({ _id: 'optionen' } as unknown as Record<string, unknown>) as Record<string, unknown> | null;
      if (doc && Array.isArray(doc[cat])) {
        const set = new Set<string>();
        for (const v of (doc[cat] as unknown[])) {
          const s = normalize(v);
          if(!s) continue;
          if (s === oldV) set.add(newV); else set.add(s);
        }
  await cfgCol.updateOne({ _id: 'optionen' } as unknown as Record<string, unknown>, { $set: { [cat]: Array.from(set) } }, { upsert: true });
      }
    } catch {}

    return NextResponse.json({ ok: true, modified: modifiedCount });
  } catch(e){
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}
