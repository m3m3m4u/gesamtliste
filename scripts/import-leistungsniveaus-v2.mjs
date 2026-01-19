#!/usr/bin/env node
/**
 * Importiert Leistungsniveaus mit Loose-Matching
 * A = Standard AHS
 * S = Standard
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

// Mapping: A = Standard AHS, S = Standard
function mapNiveau(code) {
  if (!code) return '';
  const c = String(code).toUpperCase().trim();
  if (c === 'A') return 'Standard AHS';
  if (c === 'S') return 'Standard';
  if (c === 'ASO') return 'ASO';
  return code;
}

// Normalisiere für Vergleich (entferne diakritische Zeichen)
function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Akzente entfernen
    .replace(/ß/g, 'ss')
    .replace(/đ/g, 'd')
    .replace(/ǧ/g, 'g')
    .replace(/ı/g, 'i') // türkisches ı ohne Punkt
    .replace(/ğ/g, 'g') // türkisches ğ
    .replace(/ş/g, 's') // türkisches ş
    .replace(/ç/g, 'c') // türkisches ç
    .replace(/ö/g, 'o') // türkisches ö
    .replace(/ü/g, 'u') // türkisches ü
    .trim();
}

// Spezielle Mappings für Namen
const SPECIAL_MAPPINGS = {
  'Al Bukeirat': 'Al Bkerat',
};

async function main() {
  // Excel lesen
  const xlsxPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'Leistungsniveaus.xlsx');
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  const header = rows[0];
  const idxFamilienname = header.findIndex(h => /familienname/i.test(h));
  const idxVorname = header.findIndex(h => /vorname/i.test(h));
  const idxDeutsch = header.findIndex(h => /deutsch/i.test(h));
  const idxEnglisch = header.findIndex(h => /englisch/i.test(h));
  const idxMathematik = header.findIndex(h => /mathematik/i.test(h));
  
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
  
  let updated = 0;
  let notFound = 0;
  const notFoundList = [];
  
  for (const row of dataRows) {
    let familienname = String(row[idxFamilienname] || '').trim();
    const vorname = String(row[idxVorname] || '').trim();
    const deutsch = mapNiveau(row[idxDeutsch]);
    const englisch = mapNiveau(row[idxEnglisch]);
    const mathematik = mapNiveau(row[idxMathematik]);
    
    if (!familienname || !vorname) continue;
    
    // Spezielle Mappings anwenden
    if (SPECIAL_MAPPINGS[familienname]) {
      familienname = SPECIAL_MAPPINGS[familienname];
    }
    
    const normFam = normalize(familienname);
    const normVor = normalize(vorname);
    
    // Suche: exakt oder Vorname-Prefix-Match
    let student = allStudents.find(s => {
      const sFam = normalize(s.Familienname);
      const sVor = normalize(s.Vorname);
      
      // Exakte Übereinstimmung
      if (sFam === normFam && sVor === normVor) return true;
      
      // Familienname gleich, Vorname startet mit Excel-Vorname
      if (sFam === normFam && sVor.startsWith(normVor)) return true;
      
      return false;
    });
    
    if (!student) {
      notFound++;
      notFoundList.push(`${row[idxFamilienname]}, ${row[idxVorname]}`);
      continue;
    }
    
    // Update
    const updateFields = {};
    if (deutsch) updateFields['Niveau Deutsch'] = deutsch;
    if (englisch) updateFields['Niveau Englisch'] = englisch;
    if (mathematik) updateFields['Niveau Mathematik'] = mathematik;
    updateFields.updatedAt = new Date().toISOString();
    
    await col.updateOne(
      { _id: student._id },
      { $set: updateFields }
    );
    updated++;
  }
  
  await client.close();
  
  console.log(`\n=== Ergebnis ===`);
  console.log(`Aktualisiert: ${updated}`);
  console.log(`Nicht gefunden: ${notFound}`);
  
  if (notFoundList.length > 0) {
    console.log(`\nNicht gefundene Schüler:`);
    notFoundList.forEach(n => console.log(`  - ${n}`));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
