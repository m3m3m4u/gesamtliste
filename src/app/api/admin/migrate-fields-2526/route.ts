import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/*
  Migriert bare Feldnamen auf jahresspezifische Variante für Schuljahr 25/26:
    Angebote        → Angebote 25/26
    Schwerpunkte    → Schwerpunkte 25/26
    Frühbetreuung   → Frühbetreuung 25/26
    Besuchsjahr     → Besuchsjahr 25/26

  Nur umbenennen wenn das Zielfeld NICHT bereits existiert (kein Überschreiben).
  Einmalig ausführen:
    fetch('/api/admin/migrate-fields-2526', { method: 'POST' }).then(r=>r.json()).then(console.log)
*/

const RENAMES: Record<string, string> = {
  'Angebote':       'Angebote 25/26',
  'Schwerpunkte':   'Schwerpunkte 25/26',
  'Frühbetreuung':  'Frühbetreuung 25/26',
  'Besuchsjahr':    'Besuchsjahr 25/26',
  'Religion an/ab': 'Religion an/ab 25/26',
};

export async function GET() {
  return NextResponse.json({
    info: 'Nur POST. Benennt bare Felder (Angebote, Schwerpunkte, Frühbetreuung, Besuchsjahr) auf 25/26-Variante um.',
    renames: RENAMES,
  });
}

export async function POST() {
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('students');

  // Alle Dokumente laden die mindestens eines der bare Felder haben
  const sourceFields = Object.keys(RENAMES);
  const query = { $or: sourceFields.map(f => ({ [f]: { $exists: true } })) };
  const cursor = col.find(query);

  let checked = 0;
  let modified = 0;
  const bulk: Array<{ updateOne: { filter: { _id: ObjectId }; update: Record<string, unknown> } }> = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    checked++;

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ''> = {};
    let changed = false;

    for (const [src, dst] of Object.entries(RENAMES)) {
      if (!(src in doc)) continue;
      // Nur umbenennen wenn Zielfeld noch nicht existiert
      if (dst in doc) {
        // Zielfeld existiert bereits – nur bare Feld entfernen
        $unset[src] = '';
        changed = true;
        continue;
      }
      // Wert übernehmen und bare Feld löschen
      $set[dst] = doc[src];
      $unset[src] = '';
      changed = true;
    }

    if (changed) {
      const update: Record<string, unknown> = {};
      if (Object.keys($set).length)   update['$set']   = $set;
      if (Object.keys($unset).length) update['$unset'] = $unset;
      bulk.push({ updateOne: { filter: { _id: doc._id as ObjectId }, update } });
      modified++;
    }
  }

  if (bulk.length) {
    await col.bulkWrite(bulk as Parameters<typeof col.bulkWrite>[0]);
  }

  // Auch Options-Collection umbenennen (angebote → angebote_2526 etc.)
  let optionsNote = '';
  try {
    const configCol = db.collection('config');
    const optDoc = await configCol.findOne({ _id: 'optionen' as unknown as ObjectId });
    if (optDoc) {
      const optSet: Record<string, unknown> = {};
      const optUnset: Record<string, ''> = {};
      // Mapping: bare key → jahresspezifischer key in config
      const optRenames: Record<string, string> = {
        'angebote':      'angebote_2526',
        'schwerpunkte':  'schwerpunkte_2526',
        'fruehbetreuung': 'fruehbetreuung_2526',
      };
      for (const [src, dst] of Object.entries(optRenames)) {
        if (src in optDoc && !(dst in optDoc)) {
          optSet[dst] = optDoc[src];
          optUnset[src] = '';
        } else if (src in optDoc && dst in optDoc) {
          // Ziel existiert – nur Quelle löschen
          optUnset[src] = '';
        }
      }
      const optUpdate: Record<string, unknown> = {};
      if (Object.keys(optSet).length)   optUpdate['$set']   = optSet;
      if (Object.keys(optUnset).length) optUpdate['$unset'] = optUnset;
      if (Object.keys(optUpdate).length) {
        await configCol.updateOne({ _id: 'optionen' as unknown as ObjectId }, optUpdate);
        optionsNote = 'Options-Collection ebenfalls migriert.';
      } else {
        optionsNote = 'Options-Collection: nichts zu migrieren.';
      }
    }
  } catch (e) {
    optionsNote = 'Options-Migration Fehler: ' + String(e);
  }

  return NextResponse.json({
    ok: true,
    checked,
    modified,
    optionsNote,
    renames: RENAMES,
  });
}
