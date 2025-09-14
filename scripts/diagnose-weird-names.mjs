#!/usr/bin/env node
import 'dotenv/config';
import clientPromise from '../src/lib/mongodb.js';

/*
  Diagnose-Skript: Findet Schülernamen mit
  - Steuerzeichen (C0 / DEL)
  - isolierten kombinierenden Zeichen (Combining Diacritical Marks U+0300–U+036F) ohne Basisbuchstaben davor
  - Mehrfachen aufeinanderfolgenden combining marks
  Ausgabe: CSV + detaillierte Zeilen mit Hex-Codes.
*/

function hexify(str){
  return [...str].map(ch => {
    const cp = ch.codePointAt(0).toString(16).toUpperCase().padStart(4,'0');
    const name = cp;
    return `U+${cp}`;
  }).join(' ');
}

function analyzeName(raw){
  const issues = [];
  const control = /[\x00-\x1F\x7F]/;
  if (control.test(raw)) issues.push('CONTROL');
  const chars = [...raw];
  for (let i=0;i<chars.length;i++){
    const cp = chars[i].codePointAt(0);
    if (cp>=0x300 && cp<=0x36F){
      const prev = i>0 ? chars[i-1].codePointAt(0) : null;
      if (!(prev && !(prev>=0x300 && prev<=0x36F))) {
        issues.push('LEADING_COMBINING');
      }
      // Mehrere combining hintereinander markieren
      const next = i+1<chars.length ? chars[i+1].codePointAt(0) : null;
      if (next && next>=0x300 && next<=0x36F) issues.push('COMBINING_SEQUENCE');
    }
  }
  // Wiederholte Leerzeichen
  if (/\s{2,}/.test(raw)) issues.push('MULTISPACE');
  return { issues: Array.from(new Set(issues)) };
}

(async () => {
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('students');
  const cursor = col.find({}, { projection: { Vorname:1, Familienname:1, Nachname:1, Benutzername:1 } });
  const rows = await cursor.toArray();
  const out = [];
  const detailed = [];
  for (const r of rows){
    const parts = [r.Vorname, r.Familienname || r.Nachname].filter(Boolean);
    if(!parts.length) continue;
    const full = parts.join(' ');
    const { issues } = analyzeName(full);
    if (issues.length){
      out.push({ id: r._id?.toString?.() || '', name: full, issues: issues.join('+') });
      detailed.push(`# ${r._id} :: ${full}\nIssues: ${issues.join(', ')}\nHEX: ${hexify(full)}\n`);
    }
  }
  console.log('ID;Name;Issues');
  out.forEach(o => console.log(`${o.id};${o.name};${o.issues}`));
  console.log('\n--- DETAILS ---');
  detailed.forEach(d => console.log(d));
  process.exit(0);
})();
