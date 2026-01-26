/**
 * Script zum Übernehmen ALLER Geburtsdaten aus Excel
 * (auch die mit großen Abweichungen)
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
    const jsDate = new Date((dateValue - 25569) * 86400 * 1000);
    return jsDate.toISOString().split('T')[0];
  } else if (dateValue instanceof Date) {
    return dateValue.toISOString().split('T')[0];
  } else {
    const d = new Date(dateValue);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  return null;
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

async function main() {
  const excelPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'aktuelle liste.xlsx');
  console.log(`Lese Excel-Datei: ${excelPath}`);
  
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`${data.length} Einträge in der Excel-Datei gefunden\n`);
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('Mit MongoDB verbunden\n');
  
  const db = client.db(DB_NAME);
  const collection = db.collection('students');
  
  let updated = 0;
  let notFoundInDb = [];
  
  for (const row of data) {
    const familienname = String(row.Familienname || '').trim();
    const vorname = String(row.Vorname || '').trim();
    
    if (!familienname || !vorname) continue;
    
    const excelDate = formatExcelDate(row.Geburtstdatum || row.Geburtsdatum);
    if (!excelDate) continue;
    
    // Schüler in DB suchen
    const student = await collection.findOne({
      $or: [
        { Familienname: familienname, Vorname: vorname },
        { Nachname: familienname, Vorname: vorname },
        { 
          Familienname: { $regex: new RegExp(`^${familienname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, 
          Vorname: { $regex: new RegExp(`^${vorname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        }
      ]
    });
    
    if (!student) {
      notFoundInDb.push({ familienname, vorname, excelDate });
      continue;
    }
    
    const dbDate = normalizeDate(student.Geburtsdatum);
    
    // Überschreiben wenn unterschiedlich oder fehlend
    if (excelDate !== dbDate) {
      await collection.updateOne(
        { _id: student._id },
        { $set: { Geburtsdatum: excelDate } }
      );
      updated++;
      console.log(`✅ ${familienname} ${vorname}: ${dbDate || '(leer)'} -> ${excelDate}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('ZUSAMMENFASSUNG');
  console.log('='.repeat(60));
  console.log(`✅ Geburtsdaten aktualisiert:  ${updated}`);
  console.log(`⚠️  Nicht in DB gefunden:       ${notFoundInDb.length}`);
  
  if (notFoundInDb.length > 0) {
    console.log('\nNicht gefunden:');
    for (const s of notFoundInDb) {
      console.log(`  - ${s.familienname} ${s.vorname}`);
    }
  }
  
  await client.close();
}

main().catch(console.error);
