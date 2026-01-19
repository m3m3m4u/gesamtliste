/**
 * Update der restlichen Schüler mit Matching aus Excel
 */

import { MongoClient } from 'mongodb';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

// Mapping: DB-Name -> Excel-Name (nur wo Familienname gleich + Vorname beginnt gleich)
const mappings = [
  // DB: Lässer, Lotta Luisa Marie <-> Excel: Lässer, Lotta
  { dbFam: 'Lässer', dbVor: 'Lotta', excelFam: 'Lässer', excelVor: 'Lotta' },
  // DB: Wohlgenannt, Lea Fayola <-> Excel: Wohlgenannt, Lea
  { dbFam: 'Wohlgenannt', dbVor: 'Lea', excelFam: 'Wohlgenannt', excelVor: 'Lea' },
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const excelPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'aktuelle liste.xlsx');
  const workbook = xlsx.readFile(excelPath);
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  console.log('Mit MongoDB verbunden\n');
  
  const col = client.db('gesamtliste').collection('students');
  
  let updated = 0;
  
  for (const mapping of mappings) {
    // Finde in Excel
    const excelRow = data.find(row => {
      const fam = String(row.Familienname || '').trim();
      const vor = String(row.Vorname || '').trim();
      return fam.toLowerCase() === mapping.excelFam.toLowerCase() &&
             vor.toLowerCase().startsWith(mapping.excelVor.toLowerCase());
    });
    
    if (!excelRow) {
      console.log(`✗ Excel nicht gefunden: ${mapping.excelFam}, ${mapping.excelVor}`);
      continue;
    }
    
    // Geburtsdatum
    let geburtsdatum = null;
    if (excelRow.Geburtstdatum) {
      if (typeof excelRow.Geburtstdatum === 'number') {
        const jsDate = new Date((excelRow.Geburtstdatum - 25569) * 86400 * 1000);
        geburtsdatum = jsDate.toISOString().split('T')[0];
      } else if (excelRow.Geburtstdatum instanceof Date) {
        geburtsdatum = excelRow.Geburtstdatum.toISOString().split('T')[0];
      } else {
        const d = new Date(excelRow.Geburtstdatum);
        if (!isNaN(d.getTime())) {
          geburtsdatum = d.toISOString().split('T')[0];
        }
      }
    }
    
    // Sokrates ID
    let sokratesId = null;
    if (excelRow['Sokrates ID']) {
      sokratesId = String(Math.round(excelRow['Sokrates ID']));
    }
    
    if (!geburtsdatum && !sokratesId) {
      console.log(`✗ Keine Daten in Excel für: ${mapping.excelFam}, ${mapping.excelVor}`);
      continue;
    }
    
    const updateFields = {};
    if (geburtsdatum) updateFields.Geburtsdatum = geburtsdatum;
    if (sokratesId) updateFields['Sokrates ID'] = sokratesId;
    
    // Update in DB
    const query = {
      Familienname: { $regex: new RegExp(`^${escapeRegex(mapping.dbFam)}`, 'i') },
      Vorname: { $regex: new RegExp(`^${escapeRegex(mapping.dbVor)}`, 'i') },
      _deleted: { $ne: true }
    };
    
    const result = await col.updateMany(query, { $set: updateFields });
    
    if (result.matchedCount > 0) {
      console.log(`✓ ${mapping.dbFam}, ${mapping.dbVor}: ${result.modifiedCount} aktualisiert (aus Excel: ${excelRow.Familienname}, ${excelRow.Vorname})`);
      updated += result.modifiedCount;
    } else {
      console.log(`✗ DB nicht gefunden: ${mapping.dbFam}, ${mapping.dbVor}`);
    }
  }
  
  console.log(`\n${updated} Schüler aktualisiert`);
  
  await client.close();
}

main().catch(console.error);
