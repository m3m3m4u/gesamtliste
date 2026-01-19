#!/usr/bin/env node
/**
 * Importiert Erstsprachunterricht aus public/Vorlagen/Erstsprachunterricht.xlsx
 * Verwendet Sokrates ID (Schülerkennzahl) zum Matching
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
  if (!langbezeichnung) return '';
  const match = String(langbezeichnung).match(/Erstsprachenunterricht:\s*(.+)/i);
  return match ? match[1].trim() : String(langbezeichnung).trim();
}

// Normalisiere für Vergleich (entferne diakritische Zeichen)
function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/đ/g, 'd')
    .replace(/ǧ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .trim();
}

async function main() {
  // Excel lesen
  const xlsxPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'Erstsprachunterricht.xlsx');
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  const header = rows[0];
  console.log('Header:', header);
  
  const idxSokratesId = header.findIndex(h => /schülerkennzahl/i.test(h));
  const idxFamilienname = header.findIndex(h => /familienname/i.test(h));
  const idxVorname = header.findIndex(h => /vorname/i.test(h));
  const idxLangbezeichnung = header.findIndex(h => /langbezeichnung/i.test(h));
  
  console.log(`Spalten: SokratesID=${idxSokratesId}, Familienname=${idxFamilienname}, Vorname=${idxVorname}, Langbezeichnung=${idxLangbezeichnung}`);
  
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
      bySokratesId.set(String(s['Sokrates ID']), s);
    }
  }
  
  let updated = 0;
  let notFound = 0;
  const notFoundList = [];
  
  for (const row of dataRows) {
    const sokratesId = String(row[idxSokratesId] || '').trim();
    const familienname = String(row[idxFamilienname] || '').trim();
    const vorname = String(row[idxVorname] || '').trim();
    const sprache = extractSprache(row[idxLangbezeichnung]);
    
    if (!sprache) continue;
    
    // Suche per Sokrates ID
    let student = bySokratesId.get(sokratesId);
    
    // Fallback: Name-Matching
    if (!student) {
      const normFam = normalize(familienname);
      const normVor = normalize(vorname);
      
      student = allStudents.find(s => {
        const sFam = normalize(s.Familienname);
        const sVor = normalize(s.Vorname);
        
        if (sFam === normFam && sVor === normVor) return true;
        if (sFam === normFam && sVor.startsWith(normVor)) return true;
        
        return false;
      });
    }
    
    if (!student) {
      notFound++;
      notFoundList.push(`${familienname}, ${vorname} (${sokratesId})`);
      continue;
    }
    
    // Update
    await col.updateOne(
      { _id: student._id },
      { 
        $set: { 
          'Erstsprachunterricht': sprache,
          updatedAt: new Date().toISOString()
        } 
      }
    );
    updated++;
  }
  
  await client.close();
  
  console.log(`\n=== Ergebnis ===`);
  console.log(`Aktualisiert: ${updated}`);
  console.log(`Nicht gefunden: ${notFound}`);
  
  if (notFoundList.length > 0 && notFoundList.length <= 20) {
    console.log(`\nNicht gefundene Schüler:`);
    notFoundList.forEach(n => console.log(`  - ${n}`));
  } else if (notFoundList.length > 20) {
    console.log(`\nErste 20 nicht gefundene Schüler:`);
    notFoundList.slice(0, 20).forEach(n => console.log(`  - ${n}`));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
