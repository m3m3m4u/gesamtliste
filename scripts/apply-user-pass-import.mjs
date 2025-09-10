#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) dotenv.config();
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

/*
  Script: apply-user-pass-import.mjs
  Zweck: Benutzername + Passwort für bestehende Schüler einspielen.

  Erwartetes Datei-Format (ohne Kopfzeile) pro Zeile, Tab oder mehrere Spaces als Trennzeichen:
    CODE  Familienname  Vorname  Benutzername  Passwort  Klasse
  Beispiel:
    EJ25  Akyildiz  Bartu  25ba.akyildiz  Bup35Rer78  A11

  CODE wird ignoriert (kann z.B. eine interne Kennung oder Jahrgang sein).

  Aufruf (Trockenlauf / Dry-Run = Standard):
    node scripts/apply-user-pass-import.mjs file=pfad/zur/datei.txt

  Wirkliches Schreiben (apply):
    node scripts/apply-user-pass-import.mjs file=pfad/zur/datei.txt apply=1

  WICHTIG: Bereits vorhandene Benutzernamen werden NIE überschrieben (force entfernt).

  Matching-Strategie:
    - Match über (Familienname, Vorname, Klasse) case-insensitive
    - Klasse wird mit Feldern 'Klasse 25/26', '25/26', 'Klasse' verglichen
    - Nur nicht gelöschte (_deleted != true)

  Validierungen:
    - Wenn bereits ein Benutzername existiert und force != 1 -> Übersprungen
    - Wenn mehrere Kandidaten gefunden -> Warnung, übersprungen (Mehrdeutigkeit)
    - NormBenutzername wird gesetzt (lowercase, getrimmt)
    - Leere Benutzername-Eingaben oder Platzhalter werden ignoriert
*/

const args = Object.fromEntries(process.argv.slice(2).map(a=>{
  const i = a.indexOf('=');
  if (i === -1) return [a, true];
  return [a.slice(0,i), a.slice(i+1)];
}));

const filePath = args.file || args.f || 'userpass.txt';
const doApply = args.apply == 1 || args.apply === '1' || args.apply === true;
// Überschreiben ist deaktiviert -> force entfernt

if (!fs.existsSync(filePath)) {
  console.error('Datei nicht gefunden:', filePath);
  process.exit(1);
}

function splitLine(line){
  if (line.includes('\t')) return line.split('\t').map(s=>s.trim()).filter(Boolean);
  // mehrere Spaces (>=2) als Trenner behandeln um Namen mit Einzelleerzeichen nicht zu zerschießen
  return line.split(/\s{2,}|\t/g).map(s=>s.trim()).filter(Boolean);
}

function normalizeName(s){
  return s.normalize('NFKC').replace(/\s+/g,' ').trim();
}

function normUser(u){
  return u.trim().toLowerCase();
}

function escapeRegExp(str){
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const raw = fs.readFileSync(filePath,'utf8');
const lines = raw.split(/\r?\n/).map(l=>l.trim()).filter(l=>l && !l.startsWith('#'));

const rows = [];
for (const line of lines){
  const parts = splitLine(line);
  if (parts.length < 6) { 
    console.warn('Übersprungen (zu wenig Spalten):', line); 
    continue; 
  }
  const [code, famRaw, vorRaw, benRaw, passRaw, klasseRaw] = parts;
  const Familienname = normalizeName(famRaw);
  const Vorname = normalizeName(vorRaw);
  const Benutzername = benRaw.trim();
  const Passwort = passRaw.trim();
  const Klasse = klasseRaw.trim();
  if (!Benutzername || Benutzername === '0' || /^nan$/i.test(Benutzername)) {
    console.warn('Leerer/ungültiger Benutzername -> übersprungen:', Familienname, Vorname, Klasse);
    continue;
  }
  rows.push({ code, Familienname, Vorname, Benutzername, Passwort, Klasse, originalLine: line });
}

(async ()=>{
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI fehlt'); process.exit(1); }
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const col = db.collection('students');

  let updated = 0, skippedExisting = 0, ambiguous = 0, missing = 0, conflicted = 0;
  const missingRows = [];

    for (const r of rows){
      const famRe = new RegExp('^'+escapeRegExp(r.Familienname)+'$', 'i');
      const vorRe = new RegExp('^'+escapeRegExp(r.Vorname)+'$', 'i');
      const query = {
        Familienname: famRe,
        Vorname: vorRe,
        $or: [
          { 'Klasse 25/26': r.Klasse },
          { '25/26': r.Klasse },
          { Klasse: r.Klasse },
        ],
        $orDeleted: { $or: [ { _deleted: { $exists: false } }, { _deleted: { $ne: true } } ] }
      };
      // Workaround: Mongo erlaubt kein $orDeleted; wir expandieren
      const realQuery = {
        $and: [
          { Familienname: famRe },
          { Vorname: vorRe },
          { $or: [ { 'Klasse 25/26': r.Klasse }, { '25/26': r.Klasse }, { Klasse: r.Klasse } ] },
          { $or: [ { _deleted: { $exists: false } }, { _deleted: { $ne: true } } ] }
        ]
      };

      const matches = await col.find(realQuery).toArray();
      if (matches.length === 0){
        console.warn('Kein Match gefunden:', r.Familienname, r.Vorname, r.Klasse);
        missingRows.push(r);
        missing++; continue;
      }
      if (matches.length > 1){
        console.warn('Mehrere Matches, übersprungen:', r.Familienname, r.Vorname, r.Klasse, 'IDs:', matches.map(m=>m._id));
        ambiguous++; continue;
      }
      const doc = matches[0];
      if (doc.Benutzername){
        // Nie überschreiben
        skippedExisting++; continue;
      }
      // Prüfe Konflikt: gleicher NormBenutzername bereits auf anderem Datensatz
      const intendedNorm = normUser(r.Benutzername);
      const conflict = await col.findOne({ _id: { $ne: doc._id }, NormBenutzername: intendedNorm });
      if (conflict){
        console.warn('Konflikt: NormBenutzername existiert bereits -> übersprungen', r.Benutzername, 'ZielID', doc._id, 'KonfliktID', conflict._id);
        conflicted++; continue;
      }
      if (doApply){
        await col.updateOne({ _id: doc._id }, { $set: { Benutzername: r.Benutzername.trim(), Passwort: r.Passwort, NormBenutzername: intendedNorm, updatedAt: new Date() } });
      }
      updated++;
    }

    console.log('\n--- Zusammenfassung ---');
    console.log('Eingelesene Zeilen      :', rows.length);
    console.log('Aktualisiert (geplant)  :', updated);
    console.log('Vorhanden (übersprungen):', skippedExisting);
    console.log('Mehrdeutig (skip)       :', ambiguous);
    console.log('Nicht gefunden          :', missing);
  console.log('Überschrieben            : 0 (deaktiviert)');
    console.log('Konflikte NormBenutzer  :', conflicted);
    console.log('Modus                   :', doApply ? 'APPLY (geschrieben)' : 'DRY-RUN (nichts geschrieben)');
    if (missingRows.length){
      console.log('\n--- NICHT GEFUNDENE ZEILEN (Export) ---');
      console.log('CODE\tFamilienname\tVorname\tBenutzername\tPasswort\tKlasse');
      for (const m of missingRows){
        console.log([m.code,m.Familienname,m.Vorname,m.Benutzername,m.Passwort,m.Klasse].join('\t'));
      }
      console.log('--- ENDE ---');
    }
  } catch (e){
    console.error('Fehler:', e);
    process.exit(1);
  } finally {
    await client.close();
  }
})();
