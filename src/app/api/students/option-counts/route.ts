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
      Schwerpunkte: 1,
      Schwerpunkt: 1,
      'Frühbetreuung': 1,
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
    };

    for (const d of docs) {
      // Angebote (Array oder String mit Separatoren)
      addMany(out.angebote, (d as Record<string, unknown>).Angebote);

      // Schwerpunkte: nur aus 'Schwerpunkte' und 'Schwerpunkt' sammeln (Schwerpunkt 1 wird ignoriert)
      const schSet = new Set<string>();
      for (const k of ['Schwerpunkte','Schwerpunkt'] as const) {
        const val = (d as Record<string, unknown>)[k];
        const tmp: CountMap = {};
        addMany(tmp, val);
        for (const key of Object.keys(tmp)) schSet.add(key);
      }
      for (const s of schSet) add(out.schwerpunkte, s);

      // Frühbetreuung
      addMany(out.fruehbetreuung, (d as Record<string, unknown>)['Frühbetreuung']);

      // Status (kann Array oder String sein)
      addMany(out.status, (d as Record<string, unknown>).Status);

      // Religion (einfaches Feld)
      add(out.religionen, (d as Record<string, unknown>).Religion);

      // Klassen (mehrere mögliche Felder, pro Dokument deduplizieren)
      const kset = new Set<string>();
      for (const k of ['Klasse 25/26','25/26'] as const) {
        const val = (d as Record<string, unknown>)[k];
        const tmp: CountMap = {};
        addMany(tmp, val);
        for (const key of Object.keys(tmp)) kset.add(key);
      }
      for (const k of kset) add(out.klassen, k);

      // Sprachen (Muttersprache)
      add(out.sprachen, (d as Record<string, unknown>).Muttersprache);
    }

    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}
