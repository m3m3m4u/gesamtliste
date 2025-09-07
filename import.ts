import dotenv from 'dotenv';
// Erst .env.local laden (Next.js Konvention), dann Fallback auf .env
dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) {
  dotenv.config();
}
import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI fehlt in .env.local');
    process.exit(1);
  }
  // Datei-Pfade: 1) CLI-Arg 2) data/import.json 3) Downloads/Gesamtliste.json
  const argFile = process.argv[2];
  const primary = path.join(process.cwd(), 'data', 'import.json');
  const alt = path.join(process.cwd(), '..', 'Downloads', 'Gesamtliste.json');
  const file = argFile && fs.existsSync(argFile) ? argFile : fs.existsSync(primary) ? primary : fs.existsSync(alt) ? alt : primary;
  if (!fs.existsSync(file)) {
    console.error('Keine Import-Datei gefunden. Erwartet data/import.json oder Downloads/Gesamtliste.json oder über CLI angeben.');
    process.exit(1);
  }
  console.log('Nutze Import-Datei:', file);
  const raw = fs.readFileSync(file, 'utf-8');
  let docs: any[] | undefined;
  // Versuche reguläres JSON zu parsen. Falls "NaN" Tokens enthalten sind, ersetze diese durch null.
  const tryParse = (text: string) => {
    try { return JSON.parse(text); } catch { return undefined; }
  };
  docs = tryParse(raw);
  if (!docs) {
    const sanitized = raw.replace(/\bNaN\b/g, 'null');
    docs = tryParse(sanitized);
  }
  if (!docs) {
    console.error('JSON Parsing Fehler: Datei ist kein gültiges JSON (auch nach NaN->null).');
    process.exit(1);
  }
  if (!Array.isArray(docs)) {
    console.error('JSON muss ein Array von Objekten sein.');
    process.exit(1);
  }
  if (docs.length === 0) {
    console.warn('Warnung: JSON enthält 0 Einträge – nichts zu importieren.');
    return;
  }
  // Hashing entfernt – Passwörter bleiben (optional) im Klartext
  // Transformation / Bereinigung
  const PLACEHOLDERS = new Set(['0','-','---','']);
  docs = docs.map((d: any) => {
    if (!d || typeof d !== 'object') return d;
    // Feldnamen mit verbotenen / problematischen Zeichen (.) sanitisieren
    const renamed: Record<string,string> = {};
    for (const key of Object.keys(d)) {
      if (key.includes('.')) {
        let newKey = key.replace(/\./g, '_');
        // Kollision vermeiden
        let counter = 1;
        while (newKey in d || Object.values(renamed).includes(newKey)) {
          newKey = key.replace(/\./g, '_') + '_' + counter++;
        }
        renamed[key] = newKey;
      }
    }
    for (const oldKey of Object.keys(renamed)) {
      d[renamed[oldKey]] = d[oldKey];
      delete d[oldKey];
    }
    // Geschlecht normalisieren (akzeptiere Varianten wie Geschl, Gender, sex)
    const genderKeys = Object.keys(d).filter(k=>/geschl|gender|sex/i.test(k) && k !== 'Geschlecht');
    if(!d.Geschlecht){
      for(const gk of genderKeys){ if(d[gk]) { d.Geschlecht = d[gk]; break; } }
    }
    if(typeof d.Geschlecht === 'string'){
      const g = d.Geschlecht.trim().toLowerCase();
      d.Geschlecht = g.startsWith('m') ? 'm' : g.startsWith('w') ? 'w' : '';
      if(!d.Geschlecht) delete d.Geschlecht;
    }
    // Normalisiere Angebote zu Array
    if (!Array.isArray(d.Angebote)) d.Angebote = [];
    // Trim Strings
    for (const k of Object.keys(d)) {
      if (typeof d[k] === 'string') {
        d[k] = d[k].trim();
        if (PLACEHOLDERS.has(d[k])) d[k] = null;
      }
    }
    // Klassenfelder spiegeln/vereinheitlichen: bevorzugt Anzeige-Feld "Klasse 25/26"
    const displayClassKey = 'Klasse 25/26';
    const canonicalClassKey = '25/26';
    const altDisplayClassKey = 'Klasse 25/26_1'; // falls vorherige Sanitisierung Punkte ersetzte (Sicherheitsnetz)
    // Mögliche Quellen lesen
    const rawDisplay = d[displayClassKey] ?? d[altDisplayClassKey];
    const rawCanonical = d[canonicalClassKey];
    const norm = (v: any) => (typeof v === 'string' ? v.trim() : v);
    const disp = norm(rawDisplay);
    const canon = norm(rawCanonical);
    const isEmpty = (v: any) => v == null || (typeof v === 'string' && (v === '' || PLACEHOLDERS.has(v)));
    // Konfliktlogik: wenn beide vorhanden und verschieden -> Anzeige-Feld gewinnt
    if (!isEmpty(disp) && (isEmpty(canon) || disp !== canon)) {
      d[canonicalClassKey] = disp;
      d[displayClassKey] = disp;
    } else if (!isEmpty(canon) && isEmpty(disp)) {
      // Nur kanonisch befüllt -> Anzeige-Feld nachziehen
      d[displayClassKey] = canon;
    }

    // Stufe-Felder: nur trimmen, keine Logikänderung, aber Leerwerte entfernen
    for (const key of Object.keys(d)) {
      if (/^Stufe\s*\d{2}\/\d{2}$/.test(key) && typeof d[key] === 'string') {
        d[key] = d[key].trim();
        if (PLACEHOLDERS.has(d[key])) d[key] = null;
      }
    }
    // Arrays von Platzhaltern bereinigen (z.B. Angebote)
    if (Array.isArray(d.Angebote)) {
      d.Angebote = d.Angebote.filter((x: any) => !(typeof x === 'string' && PLACEHOLDERS.has(x.trim())));
    }
    // Passwort nur Klartext behalten; kein Hash mehr
    if (d.Passwort && typeof d.Passwort === 'string') {
      d.Passwort = String(d.Passwort).trim();
      if (!d.Passwort) delete d.Passwort;
    }
    delete d.PasswortHash;
    return d;
  });
  // Duplikate im Input anhand (case-insensitive) Benutzername entfernen
  const seen = new Set<string>();
  docs = docs.filter(d => {
    const rawUser = d.Benutzername || d['Benutzername'];
    if (!rawUser) return true; // Kein Benutzername -> später separate Behandlung
    const key = String(rawUser).trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    // Speichere Normalform zusätzlich (aber Benutzername im Original beibehalten)
    d.NormBenutzername = key;
    return true;
  });
  // Optional: Duplikate anhand einer möglichen ID entfernen
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
  const col = db.collection('students');
  // Vorherigen Index (ohne partialFilter) ggf. entfernen, dann partial unique Index anlegen
  try { await col.dropIndex('NormBenutzername_1'); } catch {}
  await col.createIndex(
    { NormBenutzername: 1 },
    { unique: true, partialFilterExpression: { NormBenutzername: { $type: 'string' } } }
  ).catch(()=>{});
  await col.createIndex({ Benutzername: 1 }).catch(()=>{});
  // dedupKey: für Datensätze ohne Benutzername (Name+Geburtsdatum, sonst Name+Klasse, sonst Name-only)
  await col.createIndex(
    { dedupKey: 1 },
    { unique: true, partialFilterExpression: { dedupKey: { $type: 'string' } } }
  ).catch(()=>{});

  // Aufteilen in Bulk-Upserts damit Skript idempotent ist.
  const ops: any[] = [];
  let withoutUser = 0;
  for (const d of docs) {
    if (d.NormBenutzername == null) {
      delete d.NormBenutzername; // Kein Feld schreiben wenn null/undefined
    }
    const norm = d.NormBenutzername || (d.Benutzername ? String(d.Benutzername).trim().toLowerCase() : undefined);
    // dedupKey nur setzen, wenn kein Benutzername vorhanden ist
    const vn = typeof d.Vorname === 'string' ? d.Vorname.trim().toLowerCase() : '';
    const fn = typeof d.Familienname === 'string' ? d.Familienname.trim().toLowerCase() : '';
    const bd = typeof d.Geburtsdatum === 'string' ? d.Geburtsdatum.trim().slice(0,10) : '';
    const cls = typeof d['25/26'] === 'string' ? d['25/26'].trim().toLowerCase() : (typeof d['Klasse 25/26'] === 'string' ? d['Klasse 25/26'].trim().toLowerCase() : '');
    let dedupKey: string | undefined;
    if (!norm) {
      if (vn && fn) {
        if (bd) dedupKey = `dob|${fn}|${vn}|${bd}`;
        else if (cls) dedupKey = `cls|${fn}|${vn}|${cls}`;
        else dedupKey = `name|${fn}|${vn}`;
      }
    }
    if (norm) {
      ops.push({
        updateOne: {
          filter: { NormBenutzername: norm },
            update: {
              $set: {
                ...d,
                NormBenutzername: norm,
                ...(dedupKey ? { dedupKey } : {}),
                updatedAt: new Date()
              },
              $setOnInsert: { createdAt: new Date() }
            },
            upsert: true
        }
      });
    } else {
      // Kein Benutzername -> optionaler Insert (kann Duplikate erzeugen, wir taggen ImportStamp)
  // ImportStamp removed: we no longer tag anonymous inserts with an import timestamp
      ops.push({ insertOne: { document: { ...d, ...(dedupKey ? { dedupKey } : {}), createdAt: new Date(), updatedAt: new Date() } } });
      withoutUser++;
    }
  }

  const chunkSize = 500;
  let processed = 0;
  let upserts = 0;
  let modified = 0;
  let inserted = 0;
  // Hilfsfunktion für 3-spaltige Ausgabe
  const pad = (v: any, w = 14) => String(v).padEnd(w);
  for (let i = 0; i < ops.length; i += chunkSize) {
    const slice = ops.slice(i, i + chunkSize);
    const res = await col.bulkWrite(slice, { ordered: false });
    processed += slice.length;
    upserts += res.upsertedCount || 0;
    modified += res.modifiedCount || 0;
    inserted += res.insertedCount || 0; // Nur insertOne zählt hier; upsert inserts sind in upsertedCount
    // Ausgabe in 3+ Spalten: processed | upserts | modified | inserted
    console.log(`Batch ${i / chunkSize + 1}: ${pad('processed:' + processed, 18)}${pad('upserts:' + upserts)}${pad('modified:' + modified)}${pad('inserted:' + inserted)}`);
  }
  console.log('Fertig. Zusammenfassung:');
  console.log(pad('TotalOps:' + ops.length, 18) + pad('Upserts:' + upserts) + pad('Modified:' + modified) + pad('Inserted:' + inserted));
  console.log(`Ohne Benutzername im Input: ${withoutUser}`);
  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error('Import Fehler:', err);
  process.exit(1);
});
