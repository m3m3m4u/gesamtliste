import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

type CountMap = Record<string, number>;
type CountsPayload = {
  angebote: CountMap;
  schwerpunkte: CountMap;
  fruehbetreuung: CountMap;
  status: CountMap;
  religionen: CountMap;
  klassen: CountMap;
  sprachen: CountMap;
  // Jahresspezifisch
  angebote_2526: CountMap;
  angebote_2627: CountMap;
  schwerpunkte_2526: CountMap;
  schwerpunkte_2627: CountMap;
  fruehbetreuung_2526: CountMap;
  fruehbetreuung_2627: CountMap;
};

function add(map: CountMap, raw: unknown) {
  const s = String(raw ?? '').trim();
  if (!s || s === '-' || s === '—') return;
  map[s] = (map[s] ?? 0) + 1;
}

function addMany(map: CountMap, values: unknown) {
  if (values == null) return;
  const splitter = /[,;/\n\r\t]+/;
  if (Array.isArray(values)) {
    // WICHTIG: Array-Elemente gelten bereits als normalisierte EINZEL-Einträge.
    // Nicht erneut splitten (sonst würden zusammengesetzte Begriffe wie
    // "Informatik 5./6. Stufe" an '/' zerteilt und nie als Ganzes gezählt).
    const seen = new Set<string>();
    for (const v of values) {
      const s = String(v ?? '').trim();
      if (!s) continue;
      if (!seen.has(s)) { add(map, s); seen.add(s); }
    }
    return;
  }
  if (typeof values === 'string') {
    const s = values.trim();
    if (!s) return;
    if (splitter.test(s)) {
      const seen = new Set<string>();
      for (const part of s.split(splitter)) {
        const p = part.trim();
        if (p && !seen.has(p)) { add(map, p); seen.add(p); }
      }
    } else {
      add(map, s);
    }
    return;
  }
  // Fallback: einfacher Wert
  add(map, values);
}

export async function GET() {
  try {
    const client = await clientPromise; const db = client.db(); const col = db.collection('students');
    const baseFilter = { _deleted: { $ne: true } } as Record<string, unknown>;
    const projection = {
      _id: 0,
      Angebote: 1,
      'Angebote 26/27': 1,
      Schwerpunkte: 1,
      Schwerpunkt: 1,
      'Schwerpunkte 26/27': 1,
      'Frühbetreuung': 1,
      'Frühbetreuung 26/27': 1,
      Status: 1,
      Religion: 1,
      'Klasse 25/26': 1,
      '25/26': 1,
      Muttersprache: 1,
    } as const;
    const docs = await col.find(baseFilter, { projection }).toArray();

    const out: CountsPayload = {
      angebote: {},
      schwerpunkte: {},
      fruehbetreuung: {},
      status: {},
      religionen: {},
      klassen: {},
      sprachen: {},
      angebote_2526: {},
      angebote_2627: {},
      schwerpunkte_2526: {},
      schwerpunkte_2627: {},
      fruehbetreuung_2526: {},
      fruehbetreuung_2627: {},
    };

    for (const d of docs) {
      const doc = d as Record<string, unknown>;

      // Angebote 25/26 (Legacyfeld)
      addMany(out.angebote, doc.Angebote);
      addMany(out.angebote_2526, doc.Angebote);

      // Angebote 26/27
      addMany(out.angebote_2627, doc['Angebote 26/27']);

      // Schwerpunkte 25/26: aus 'Schwerpunkte' und 'Schwerpunkt' (Schwerpunkt 1 ignoriert)
      const schSet = new Set<string>();
      for (const k of ['Schwerpunkte','Schwerpunkt']) {
        const tmp: CountMap = {};
        addMany(tmp, doc[k]);
        for (const key of Object.keys(tmp)) schSet.add(key);
      }
      for (const s of schSet) { add(out.schwerpunkte, s); add(out.schwerpunkte_2526, s); }

      // Schwerpunkte 26/27
      addMany(out.schwerpunkte_2627, doc['Schwerpunkte 26/27']);

      // Frühbetreuung 25/26
      addMany(out.fruehbetreuung, doc['Frühbetreuung']);
      addMany(out.fruehbetreuung_2526, doc['Frühbetreuung']);

      // Frühbetreuung 26/27
      addMany(out.fruehbetreuung_2627, doc['Frühbetreuung 26/27']);

      // Status
      addMany(out.status, doc.Status);

      // Religion
      add(out.religionen, doc.Religion);

      // Klassen
      const kset = new Set<string>();
      for (const k of ['Klasse 25/26','25/26']) {
        const tmp: CountMap = {};
        addMany(tmp, doc[k]);
        for (const key of Object.keys(tmp)) kset.add(key);
      }
      for (const k of kset) add(out.klassen, k);

      // Sprachen
      add(out.sprachen, doc.Muttersprache);
    }

    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}
