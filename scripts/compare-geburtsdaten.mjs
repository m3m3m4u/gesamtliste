/**
 * Script zum Vergleichen der Geburtsdaten zwischen
 * der Excel-Datei "aktuelle liste.xlsx" und der MongoDB
 */

import { MongoClient } from 'mongodb';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.local laden
config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB-Verbindung
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'gesamtliste';

function formatExcelDate(dateValue) {
  if (!dateValue) return null;
  
  if (typeof dateValue === 'number') {
    // Excel-Datum in JavaScript-Datum konvertieren
    const jsDate = new Date((dateValue - 25569) * 86400 * 1000);
    return jsDate.toISOString().split('T')[0]; // YYYY-MM-DD
  } else if (dateValue instanceof Date) {
    return dateValue.toISOString().split('T')[0];
  } else {
    // String-Datum versuchen zu parsen
    const d = new Date(dateValue);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  return null;
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  // Verschiedene Formate normalisieren auf YYYY-MM-DD
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

async function main() {
  // Excel-Datei einlesen
  const excelPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'aktuelle liste.xlsx');
  console.log(`Lese Excel-Datei: ${excelPath}`);
  
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`${data.length} Einträge in der Excel-Datei gefunden\n`);
  
  // MongoDB verbinden
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('Mit MongoDB verbunden\n');
  
  const db = client.db(DB_NAME);
  const collection = db.collection('students');
  
  let matches = 0;
  let mismatches = [];
  let notFoundInDb = [];
  let noDateInExcel = [];
  let noDateInDb = [];
  
  for (const row of data) {
    const familienname = String(row.Familienname || '').trim();
    const vorname = String(row.Vorname || '').trim();
    
    if (!familienname || !vorname) {
      continue;
    }
    
    // Geburtsdatum aus Excel
    const excelDate = formatExcelDate(row.Geburtstdatum || row.Geburtsdatum);
    
    if (!excelDate) {
      noDateInExcel.push({ familienname, vorname });
      continue;
    }
    
    // Schüler in DB suchen
    const student = await collection.findOne({
      $or: [
        { Familienname: familienname, Vorname: vorname },
        { Nachname: familienname, Vorname: vorname },
        { 
          Familienname: { $regex: new RegExp(`^${familienname}$`, 'i') }, 
          Vorname: { $regex: new RegExp(`^${vorname}$`, 'i') } 
        }
      ]
    });
    
    if (!student) {
      notFoundInDb.push({ familienname, vorname, excelDate });
      continue;
    }
    
    // Geburtsdatum aus DB
    const dbDate = normalizeDate(student.Geburtsdatum);
    
    if (!dbDate) {
      noDateInDb.push({ 
        familienname, 
        vorname, 
        excelDate,
        klasse: student.Klasse || student.klasse || '?'
      });
      continue;
    }
    
    // Vergleich
    if (excelDate === dbDate) {
      matches++;
    } else {
      mismatches.push({
        familienname,
        vorname,
        klasse: student.Klasse || student.klasse || '?',
        excelDate,
        dbDate
      });
    }
  }
  
  // Ergebnisse ausgeben
  console.log('=' .repeat(60));
  console.log('ERGEBNIS DES VERGLEICHS');
  console.log('=' .repeat(60));
  
  console.log(`\n✅ Übereinstimmende Geburtsdaten: ${matches}`);
  
  if (mismatches.length > 0) {
    console.log(`\n❌ ABWEICHUNGEN (${mismatches.length}):`);
    console.log('-'.repeat(60));
    for (const m of mismatches) {
      console.log(`  ${m.familienname} ${m.vorname} (${m.klasse})`);
      console.log(`    Excel: ${m.excelDate} | DB: ${m.dbDate}`);
    }
  }
  
  if (notFoundInDb.length > 0) {
    console.log(`\n⚠️  Nicht in Datenbank gefunden (${notFoundInDb.length}):`);
    console.log('-'.repeat(60));
    for (const s of notFoundInDb) {
      console.log(`  ${s.familienname} ${s.vorname} (Excel-Datum: ${s.excelDate})`);
    }
  }
  
  if (noDateInDb.length > 0) {
    console.log(`\n📭 Kein Geburtsdatum in DB (${noDateInDb.length}):`);
    console.log('-'.repeat(60));
    for (const s of noDateInDb) {
      console.log(`  ${s.familienname} ${s.vorname} (${s.klasse}) - Excel: ${s.excelDate}`);
    }
  }
  
  if (noDateInExcel.length > 0) {
    console.log(`\n📭 Kein Geburtsdatum in Excel (${noDateInExcel.length}):`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('ZUSAMMENFASSUNG');
  console.log('='.repeat(60));
  console.log(`  Übereinstimmend:      ${matches}`);
  console.log(`  Abweichungen:         ${mismatches.length}`);
  console.log(`  Nicht in DB:          ${notFoundInDb.length}`);
  console.log(`  Ohne Datum in DB:     ${noDateInDb.length}`);
  console.log(`  Ohne Datum in Excel:  ${noDateInExcel.length}`);
  
  await client.close();
}

main().catch(console.error);
