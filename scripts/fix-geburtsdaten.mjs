/**
 * Script zum Korrigieren der Geburtsdaten:
 * 1. 1-Tag-Abweichungen automatisch korrigieren (Excel übernehmen)
 * 2. Fehlende Geburtsdaten aus Excel importieren
 * 3. Starke Abweichungen in Bericht schreiben
 */

import { MongoClient } from 'mongodb';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
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
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

function daysDifference(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
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
  
  let oneDayFixed = 0;
  let missingDatesFilled = 0;
  let majorMismatches = [];
  let notFoundInDb = [];
  
  for (const row of data) {
    const familienname = String(row.Familienname || '').trim();
    const vorname = String(row.Vorname || '').trim();
    
    if (!familienname || !vorname) {
      continue;
    }
    
    // Geburtsdatum aus Excel
    const excelDate = formatExcelDate(row.Geburtstdatum || row.Geburtsdatum);
    
    if (!excelDate) {
      continue;
    }
    
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
    
    // Geburtsdatum aus DB
    const dbDate = normalizeDate(student.Geburtsdatum);
    
    // Fall 1: Kein Datum in DB -> importieren
    if (!dbDate) {
      await collection.updateOne(
        { _id: student._id },
        { $set: { Geburtsdatum: excelDate } }
      );
      missingDatesFilled++;
      console.log(`📥 Importiert: ${familienname} ${vorname} -> ${excelDate}`);
      continue;
    }
    
    // Falls Daten gleich -> nichts tun
    if (excelDate === dbDate) {
      continue;
    }
    
    // Differenz berechnen
    const diff = daysDifference(excelDate, dbDate);
    
    // Fall 2: 1-Tag-Abweichung -> automatisch korrigieren
    if (diff === 1) {
      await collection.updateOne(
        { _id: student._id },
        { $set: { Geburtsdatum: excelDate } }
      );
      oneDayFixed++;
      console.log(`🔧 1-Tag-Fix: ${familienname} ${vorname}: ${dbDate} -> ${excelDate}`);
    } else {
      // Fall 3: Größere Abweichung -> Bericht
      majorMismatches.push({
        familienname,
        vorname,
        klasse: student.Klasse || student.klasse || '?',
        excelDate,
        dbDate,
        diffDays: diff
      });
    }
  }
  
  // Bericht für starke Abweichungen erstellen
  const reportPath = path.join(__dirname, '..', 'geburtsdaten-abweichungen-bericht.txt');
  let report = `GEBURTSDATEN - STARKE ABWEICHUNGEN (> 1 Tag)
Erstellt: ${new Date().toLocaleString('de-AT')}
${'='.repeat(70)}

Diese Fälle müssen manuell geprüft werden:

`;

  for (const m of majorMismatches) {
    report += `${m.familienname} ${m.vorname} (${m.klasse})
  Excel-Datum:  ${m.excelDate}
  DB-Datum:     ${m.dbDate}
  Differenz:    ${m.diffDays} Tage
${'-'.repeat(50)}
`;
  }

  report += `
${'='.repeat(70)}
NICHT IN DATENBANK GEFUNDEN (${notFoundInDb.length}):
${'='.repeat(70)}
`;

  for (const s of notFoundInDb) {
    report += `${s.familienname} ${s.vorname} (Excel-Datum: ${s.excelDate})\n`;
  }

  fs.writeFileSync(reportPath, report);
  
  // Zusammenfassung
  console.log('\n' + '='.repeat(60));
  console.log('ZUSAMMENFASSUNG');
  console.log('='.repeat(60));
  console.log(`✅ 1-Tag-Abweichungen korrigiert:     ${oneDayFixed}`);
  console.log(`✅ Fehlende Daten importiert:         ${missingDatesFilled}`);
  console.log(`⚠️  Starke Abweichungen (Bericht):    ${majorMismatches.length}`);
  console.log(`⚠️  Nicht in DB gefunden:             ${notFoundInDb.length}`);
  console.log(`\n📄 Bericht gespeichert: ${reportPath}`);
  
  await client.close();
}

main().catch(console.error);
