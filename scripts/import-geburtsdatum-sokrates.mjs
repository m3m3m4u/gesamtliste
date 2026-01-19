/**
 * Script zum Importieren von Geburtsdatum und Sokrates ID
 * aus der Excel-Datei "aktuelle liste.xlsx" in die MongoDB
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

async function main() {
  // Excel-Datei einlesen
  const excelPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'aktuelle liste.xlsx');
  console.log(`Lese Excel-Datei: ${excelPath}`);
  
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`${data.length} Einträge in der Excel-Datei gefunden`);
  
  // MongoDB verbinden
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('Mit MongoDB verbunden');
  
  const db = client.db(DB_NAME);
  const collection = db.collection('students');
  
  let updated = 0;
  let notFound = 0;
  let errors = [];
  
  for (const row of data) {
    const familienname = String(row.Familienname || '').trim();
    const vorname = String(row.Vorname || '').trim();
    
    if (!familienname || !vorname) {
      console.log(`Überspringe Zeile ohne Namen`);
      continue;
    }
    
    // Geburtsdatum formatieren
    let geburtsdatum = null;
    if (row.Geburtstdatum) {
      // Excel speichert Datum oft als Zahl (Tage seit 1900)
      if (typeof row.Geburtstdatum === 'number') {
        // Excel-Datum in JavaScript-Datum konvertieren
        const excelDate = row.Geburtstdatum;
        const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
        geburtsdatum = jsDate.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (row.Geburtstdatum instanceof Date) {
        geburtsdatum = row.Geburtstdatum.toISOString().split('T')[0];
      } else {
        // String-Datum versuchen zu parsen
        const d = new Date(row.Geburtstdatum);
        if (!isNaN(d.getTime())) {
          geburtsdatum = d.toISOString().split('T')[0];
        }
      }
    }
    
    // Sokrates ID (als String speichern, da große Zahl)
    let sokratesId = null;
    if (row['Sokrates ID']) {
      // Als Integer-String speichern (keine Dezimalstellen)
      sokratesId = String(Math.round(row['Sokrates ID']));
    }
    
    // Schüler in der Datenbank suchen
    const query = {
      Familienname: { $regex: new RegExp(`^${escapeRegex(familienname)}$`, 'i') },
      Vorname: { $regex: new RegExp(`^${escapeRegex(vorname)}$`, 'i') },
      _deleted: { $ne: true }
    };
    
    const updateFields = {};
    if (geburtsdatum) {
      updateFields.Geburtsdatum = geburtsdatum;
    }
    if (sokratesId) {
      updateFields['Sokrates ID'] = sokratesId;
    }
    
    if (Object.keys(updateFields).length === 0) {
      continue;
    }
    
    try {
      const result = await collection.updateMany(query, { $set: updateFields });
      
      if (result.matchedCount > 0) {
        updated += result.modifiedCount;
        if (result.matchedCount > 1) {
          console.log(`  ${familienname}, ${vorname}: ${result.matchedCount} Treffer, ${result.modifiedCount} aktualisiert`);
        }
      } else {
        notFound++;
        errors.push(`Nicht gefunden: ${familienname}, ${vorname}`);
      }
    } catch (err) {
      console.error(`Fehler bei ${familienname}, ${vorname}:`, err.message);
    }
  }
  
  console.log('\n=== ZUSAMMENFASSUNG ===');
  console.log(`Aktualisiert: ${updated}`);
  console.log(`Nicht gefunden: ${notFound}`);
  
  if (errors.length > 0 && errors.length <= 20) {
    console.log('\nNicht gefundene Schüler:');
    errors.forEach(e => console.log(`  - ${e}`));
  } else if (errors.length > 20) {
    console.log(`\nErste 20 nicht gefundene Schüler:`);
    errors.slice(0, 20).forEach(e => console.log(`  - ${e}`));
    console.log(`  ... und ${errors.length - 20} weitere`);
  }
  
  await client.close();
  console.log('\nFertig!');
}

// Hilfsfunktion: Regex-Sonderzeichen escapen
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch(console.error);
