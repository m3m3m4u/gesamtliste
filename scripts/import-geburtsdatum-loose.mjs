/**
 * Script zum Importieren von Geburtsdatum und Sokrates ID
 * mit lockerem Matching (Vorname beginnt mit...)
 */

import { MongoClient } from 'mongodb';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'gesamtliste';

// Die 30 nicht gefundenen mit lockerem Matching
const needsLooseMatch = new Set([
  'Steinberger, Milan',
  'Kluth, Noel',
  'Hubel, Eva',
  'Yilmaz, Zümra',
  'Dür, Vincent',
  'Kainz, Paul',
  'Kathrein, Noa',
  'Yilmaz, Fatma',
  'Djordjević, Don',
  'Chen, Xin',
  'Marx, Niclas',
  'Yalcin, Sevval',
  'Yurtdas, Erva',
  'Rau, Levian',
  'Radovic, Anastasia',
  'Steinberger, Leon',
  'Yıldırım, Ömer'
]);

// Spezialfälle mit unterschiedlicher Schreibweise
const specialCases = {
  'Aye Adnan, Kenaan': { Familienname: 'Kenaan Aye Adnan', Vorname: 'Kenaan Aye Adnan' },
  'Radovic, Anastasia': { Familienname: 'Radovic', Vorname: 'Anastasija' }, // Schreibweise
};

async function main() {
  const excelPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'aktuelle liste.xlsx');
  console.log(`Lese Excel-Datei: ${excelPath}`);
  
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('Mit MongoDB verbunden');
  
  const db = client.db(DB_NAME);
  const collection = db.collection('students');
  
  let updated = 0;
  let notFound = 0;
  const errors = [];
  
  for (const row of data) {
    const familienname = String(row.Familienname || '').trim();
    const vorname = String(row.Vorname || '').trim();
    const key = `${familienname}, ${vorname}`;
    
    if (!familienname || !vorname) continue;
    
    // Geburtsdatum formatieren
    let geburtsdatum = null;
    if (row.Geburtstdatum) {
      if (typeof row.Geburtstdatum === 'number') {
        const excelDate = row.Geburtstdatum;
        const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
        geburtsdatum = jsDate.toISOString().split('T')[0];
      } else if (row.Geburtstdatum instanceof Date) {
        geburtsdatum = row.Geburtstdatum.toISOString().split('T')[0];
      } else {
        const d = new Date(row.Geburtstdatum);
        if (!isNaN(d.getTime())) {
          geburtsdatum = d.toISOString().split('T')[0];
        }
      }
    }
    
    // Sokrates ID
    let sokratesId = null;
    if (row['Sokrates ID']) {
      sokratesId = String(Math.round(row['Sokrates ID']));
    }
    
    if (!geburtsdatum && !sokratesId) continue;
    
    const updateFields = {};
    if (geburtsdatum) updateFields.Geburtsdatum = geburtsdatum;
    if (sokratesId) updateFields['Sokrates ID'] = sokratesId;
    
    let query;
    
    // Spezialfall?
    if (specialCases[key]) {
      const special = specialCases[key];
      query = {
        Familienname: { $regex: new RegExp(`^${escapeRegex(special.Familienname)}`, 'i') },
        Vorname: { $regex: new RegExp(`^${escapeRegex(special.Vorname)}`, 'i') },
        _deleted: { $ne: true }
      };
    } else if (needsLooseMatch.has(key)) {
      // Lockeres Matching: Vorname beginnt mit
      query = {
        Familienname: { $regex: new RegExp(`^${escapeRegex(familienname)}$`, 'i') },
        Vorname: { $regex: new RegExp(`^${escapeRegex(vorname)}`, 'i') },
        _deleted: { $ne: true }
      };
    } else {
      // Exaktes Matching (wurde schon verarbeitet, überspringe)
      continue;
    }
    
    try {
      const result = await collection.updateMany(query, { $set: updateFields });
      
      if (result.matchedCount > 0) {
        updated += result.modifiedCount;
        console.log(`✓ ${familienname}, ${vorname}: ${result.matchedCount} gefunden, ${result.modifiedCount} aktualisiert`);
      } else {
        notFound++;
        errors.push(`${familienname}, ${vorname}`);
      }
    } catch (err) {
      console.error(`Fehler bei ${familienname}, ${vorname}:`, err.message);
    }
  }
  
  console.log('\n=== ZUSAMMENFASSUNG ===');
  console.log(`Aktualisiert: ${updated}`);
  console.log(`Nicht gefunden: ${notFound}`);
  
  if (errors.length > 0) {
    console.log('\nImmer noch nicht gefunden:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
  
  await client.close();
  console.log('\nFertig!');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch(console.error);
