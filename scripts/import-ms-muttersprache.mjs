#!/usr/bin/env node
/**
 * Importiert Muttersprachlichen Unterricht aus public/Vorlagen/MS Muttersprache.xlsx
 * Verwendet Schülerkennzahl (Sokrates ID) zum Matching
 * Setzt das Feld "Erstsprachunterricht" in der Datenbank
 */

import XLSX from 'xlsx';
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI nicht gesetzt');
  process.exit(1);
}

// Extrahiere Sprache aus "Erstsprachenunterricht: Arabisch" -> "Arabisch"
function extractSprache(langbezeichnung) {
  if (!langbezeichnung) return null;
  const match = String(langbezeichnung).match(/Erstsprachenunterricht:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

// Normalisiere für Vergleich (entferne diakritische Zeichen)
function normalize(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function main() {
  // Excel lesen
  const xlsxPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'MS Muttersprache.xlsx');
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  const header = rows[0];
  console.log('Header:', header);
  
  // Spalten finden
  const idxSokratesId = header.findIndex(h => /schülerkennzahl/i.test(String(h)));
  const idxFamilienname = header.findIndex(h => /familienname/i.test(String(h)));
  const idxVorname = header.findIndex(h => /vorname/i.test(String(h)));
  const idxLangbezeichnung = header.findIndex(h => /langbezeichnung/i.test(String(h)));
  
  console.log(`Spalten: SokratesID=${idxSokratesId}, Familienname=${idxFamilienname}, Vorname=${idxVorname}, Langbezeichnung=${idxLangbezeichnung}`);
  
  if (idxSokratesId < 0 || idxLangbezeichnung < 0) {
    console.error('Erforderliche Spalten nicht gefunden!');
    process.exit(1);
  }
  
  const dataRows = rows.slice(1).filter(r => r && r.length > 0);
  console.log(`${dataRows.length} Zeilen in Excel`);
  
  // MongoDB
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  const col = db.collection('students');
  
  // Alle aktiven Schüler laden
  const allStudents = await col.find({ _deleted: { $ne: true } }).toArray();
  console.log(`${allStudents.length} Schüler in DB geladen`);
  
  // Index nach Sokrates ID
  const bySokratesId = new Map();
  for (const s of allStudents) {
    if (s['Sokrates ID']) {
      const id = String(s['Sokrates ID']).trim();
      bySokratesId.set(id, s);
    }
  }
  console.log(`${bySokratesId.size} Schüler mit Sokrates ID indexiert`);
  
  let updated = 0;
  let notFound = 0;
  let skipped = 0;
  const notFoundList = [];
  
  for (const row of dataRows) {
    const sokratesId = row[idxSokratesId];
    const familienname = row[idxFamilienname];
    const vorname = row[idxVorname];
    const langbezeichnung = row[idxLangbezeichnung];
    
    if (!sokratesId) {
      skipped++;
      continue;
    }
    
    const sprache = extractSprache(langbezeichnung);
    if (!sprache) {
      skipped++;
      continue;
    }
    
    const sokratesIdStr = String(sokratesId).trim();
    const student = bySokratesId.get(sokratesIdStr);
    
    if (!student) {
      notFound++;
      notFoundList.push(`${familienname}, ${vorname} (${sokratesIdStr})`);
      continue;
    }
    
    // Update in DB
    await col.updateOne(
      { _id: student._id },
      { $set: { 'Erstsprachunterricht': sprache } }
    );
    updated++;
    console.log(`✓ ${student.Familienname}, ${student.Vorname} -> ${sprache}`);
  }
  
  await client.close();
  
  console.log(`\n=== Ergebnis ===`);
  console.log(`Aktualisiert: ${updated}`);
  console.log(`Nicht gefunden: ${notFound}`);
  console.log(`Übersprungen: ${skipped}`);
  
  if (notFoundList.length > 0 && notFoundList.length <= 20) {
    console.log(`\nNicht gefundene Schüler:`);
    notFoundList.forEach(n => console.log(`  - ${n}`));
  } else if (notFoundList.length > 20) {
    console.log(`\nErste 20 nicht gefundene Schüler:`);
    notFoundList.slice(0, 20).forEach(n => console.log(`  - ${n}`));
  }
}

main().catch(console.error);
