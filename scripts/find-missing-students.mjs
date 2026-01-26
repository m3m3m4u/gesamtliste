/**
 * Suche nach den fehlenden Schülern mit flexibler Namenssuche
 */

import { MongoClient } from 'mongodb';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

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

// Die 14 nicht gefundenen Schüler
const missing = [
  { familienname: 'Dür', vorname: 'Vincent' },
  { familienname: 'Kainz', vorname: 'Paul' },
  { familienname: 'Yilmaz', vorname: 'Fatma' },
  { familienname: 'Bahl', vorname: 'Ilva' },
  { familienname: 'Brun', vorname: 'Maximilian' },
  { familienname: 'Gutschi', vorname: 'Sarah' },
  { familienname: 'Hartmann', vorname: 'Annalena' },
  { familienname: 'Lässer', vorname: 'Lotta' },
  { familienname: 'Rak', vorname: 'Kevin' },
  { familienname: 'Waltersdorfer', vorname: 'Maria' },
  { familienname: 'Wohlgenannt', vorname: 'Lea' },
  { familienname: 'Wurzenrainer', vorname: 'Jana' },
  { familienname: 'Al Bkerat', vorname: 'Ibrahim' },
  { familienname: 'Choura', vorname: 'Sham' },
];

async function main() {
  const excelPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'aktuelle liste.xlsx');
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const excelData = xlsx.utils.sheet_to_json(sheet);
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('Mit MongoDB verbunden\n');
  
  const db = client.db(DB_NAME);
  const collection = db.collection('students');
  
  for (const m of missing) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Suche: ${m.familienname} ${m.vorname}`);
    console.log('='.repeat(60));
    
    // Excel-Datum holen
    const excelRow = excelData.find(r => 
      String(r.Familienname || '').trim() === m.familienname && 
      String(r.Vorname || '').trim() === m.vorname
    );
    const excelDate = excelRow ? formatExcelDate(excelRow.Geburtstdatum || excelRow.Geburtsdatum) : null;
    console.log(`Excel-Datum: ${excelDate}`);
    
    // Suche nach Familienname (enthält)
    const byFamilienname = await collection.find({
      $or: [
        { Familienname: { $regex: m.familienname, $options: 'i' } },
        { Nachname: { $regex: m.familienname, $options: 'i' } }
      ]
    }).toArray();
    
    if (byFamilienname.length > 0) {
      console.log(`\nGefunden mit Familienname "${m.familienname}":`);
      for (const s of byFamilienname) {
        console.log(`  → ${s.Familienname || s.Nachname} ${s.Vorname} (Klasse: ${s.Klasse || s.klasse || '?'}, Geb: ${s.Geburtsdatum || '-'})`);
      }
    }
    
    // Suche nach Vorname (enthält)
    const byVorname = await collection.find({
      Vorname: { $regex: m.vorname, $options: 'i' }
    }).toArray();
    
    // Nur anzeigen wenn es andere als die bereits gefundenen sind
    const newByVorname = byVorname.filter(s => 
      !byFamilienname.some(f => f._id.toString() === s._id.toString())
    );
    
    if (newByVorname.length > 0) {
      console.log(`\nGefunden mit Vorname "${m.vorname}" (anderer Familienname):`);
      for (const s of newByVorname) {
        console.log(`  → ${s.Familienname || s.Nachname} ${s.Vorname} (Klasse: ${s.Klasse || s.klasse || '?'}, Geb: ${s.Geburtsdatum || '-'})`);
      }
    }
    
    if (byFamilienname.length === 0 && byVorname.length === 0) {
      console.log('  ❌ Keine Treffer gefunden');
    }
  }
  
  await client.close();
}

main().catch(console.error);
