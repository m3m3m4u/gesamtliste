import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
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
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
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
    // Normalisiere Angebote zu Array
    if (!Array.isArray(d.Angebote)) d.Angebote = [];
    // Trim Strings
    for (const k of Object.keys(d)) {
      if (typeof d[k] === 'string') {
        d[k] = d[k].trim();
        if (PLACEHOLDERS.has(d[k])) d[k] = null;
      }
    }
    // Arrays von Platzhaltern bereinigen (z.B. Angebote)
    if (Array.isArray(d.Angebote)) {
      d.Angebote = d.Angebote.filter((x: any) => !(typeof x === 'string' && PLACEHOLDERS.has(x.trim())));
    }
    // Passwort-Hashing (falls vorhanden und nicht '0' oder leer)
    if (d.Passwort && d.Passwort !== '0') {
      try {
        const hash = bcrypt.hashSync(String(d.Passwort), saltRounds);
        d.PasswortHash = hash;
      } catch (e) {
        console.warn('Konnte Passwort nicht hashen für Benutzer:', d.Benutzername, e);
      }
    }
    // Entferne Klartext Passwort
    delete d.Passwort;
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

  // Aufteilen in Bulk-Upserts damit Skript idempotent ist.
  const ops: any[] = [];
  let withoutUser = 0;
  for (const d of docs) {
    if (d.NormBenutzername == null) {
      delete d.NormBenutzername; // Kein Feld schreiben wenn null/undefined
    }
    const norm = d.NormBenutzername || (d.Benutzername ? String(d.Benutzername).trim().toLowerCase() : undefined);
    if (norm) {
      ops.push({
        updateOne: {
          filter: { NormBenutzername: norm },
            update: {
              $set: {
                ...d,
                NormBenutzername: norm,
                updatedAt: new Date()
              },
              $setOnInsert: { createdAt: new Date() }
            },
            upsert: true
        }
      });
    } else {
      // Kein Benutzername -> optionaler Insert (kann Duplikate erzeugen, wir taggen ImportStamp)
      d.ImportStamp = Date.now();
      ops.push({ insertOne: { document: { ...d, createdAt: new Date(), updatedAt: new Date() } } });
      withoutUser++;
    }
  }

  const chunkSize = 500;
  let processed = 0;
  let upserts = 0;
  let modified = 0;
  let inserted = 0;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const slice = ops.slice(i, i + chunkSize);
    const res = await col.bulkWrite(slice, { ordered: false });
    processed += slice.length;
    upserts += res.upsertedCount || 0;
    modified += res.modifiedCount || 0;
    inserted += res.insertedCount || 0; // Nur insertOne zählt hier; upsert inserts sind in upsertedCount
    console.log(`Batch ${i / chunkSize + 1}: processed=${processed} upserts=${upserts} modified=${modified} inserted=${inserted}`);
  }
  console.log(`Fertig. Total Ops: ${ops.length}, Upserts: ${upserts}, Modified: ${modified}, Inserted(no-username or upserted separately): ${inserted}, Ohne Benutzername im Input: ${withoutUser}`);
  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error('Import Fehler:', err);
  process.exit(1);
});
