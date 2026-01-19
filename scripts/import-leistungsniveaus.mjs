#!/usr/bin/env node
/**
 * Importiert Leistungsniveaus aus public/Vorlagen/Leistungsniveaus.xlsx
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
  return code; // Unbekannt: Originalwert behalten
}

async function main() {
  // Excel lesen
  const xlsxPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'Leistungsniveaus.xlsx');
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  // Header finden
  const header = rows[0];
  console.log('Header:', header);
  
  const idxKlasse = header.findIndex(h => /klasse/i.test(h));
  const idxFamilienname = header.findIndex(h => /familienname/i.test(h));
  const idxVorname = header.findIndex(h => /vorname/i.test(h));
  const idxDeutsch = header.findIndex(h => /deutsch/i.test(h));
  const idxEnglisch = header.findIndex(h => /englisch/i.test(h));
  const idxMathematik = header.findIndex(h => /mathematik/i.test(h));
  
  console.log(`Spalten: Klasse=${idxKlasse}, Familienname=${idxFamilienname}, Vorname=${idxVorname}, Deutsch=${idxDeutsch}, Englisch=${idxEnglisch}, Mathematik=${idxMathematik}`);
  
  // Datenzeilen
  const dataRows = rows.slice(1).filter(r => r && r.length > 0);
  console.log(`${dataRows.length} Zeilen in Excel`);
  
  // MongoDB
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  const col = db.collection('students');
  
  let updated = 0;
  let notFound = 0;
  const notFoundList = [];
  
  for (const row of dataRows) {
    const familienname = String(row[idxFamilienname] || '').trim();
    const vorname = String(row[idxVorname] || '').trim();
    const deutsch = mapNiveau(row[idxDeutsch]);
    const englisch = mapNiveau(row[idxEnglisch]);
    const mathematik = mapNiveau(row[idxMathematik]);
    
    if (!familienname || !vorname) continue;
    
    // Suche Schüler (nicht gelöscht)
    const student = await col.findOne({
      Familienname: { $regex: new RegExp(`^${familienname}$`, 'i') },
      Vorname: { $regex: new RegExp(`^${vorname}$`, 'i') },
      _deleted: { $ne: true }
    });
    
    if (!student) {
      notFound++;
      notFoundList.push(`${familienname}, ${vorname}`);
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
