/**
 * Finale Korrektur für die verbleibenden Schüler
 */

import { MongoClient } from 'mongodb';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

// Mapping: Excel-Name -> DB-Suchkriterien
const specialMappings = {
  'Seres, Mihrimah-Seray': { Familienname: 'Şereş', VornamePrefix: 'Mihrimah' },
  'Läßer, Lene': { Familienname: 'Lässer', VornamePrefix: 'Lene' },
  'Baǧlan, Hasan': { Familienname: 'Bağlan', VornamePrefix: 'Hasan' },
  'Baǧlan, Mir': { Familienname: 'Bağlan', VornamePrefix: 'Mir' },
  'Barati, Nicole Katia': { Familienname: 'Barati', VornamePrefix: 'Nicole' },
  'Akyildiz, Olguncan': { Familienname: 'Akyildiz', VornamePrefix: 'Olgun' },
  'Shoura, Lilia': { Familienname: 'Choura', VornamePrefix: 'Lilia' },
  'Choura, Sham': { Familienname: 'Shoura', VornamePrefix: 'Sham' },
  'Resch, Lara': { Familienname: 'Resch', VornamePrefix: 'Lara' },
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const excelPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'aktuelle liste.xlsx');
  const workbook = xlsx.readFile(excelPath);
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  console.log('Mit MongoDB verbunden');
  
  const col = client.db('gesamtliste').collection('students');
  
  let updated = 0;
  
  for (const row of data) {
    const fam = String(row.Familienname || '').trim();
    const vor = String(row.Vorname || '').trim();
    const key = `${fam}, ${vor}`;
    
    if (!specialMappings[key]) continue;
    
    const mapping = specialMappings[key];
    
    // Geburtsdatum
    let geburtsdatum = null;
    if (row.Geburtstdatum) {
      if (typeof row.Geburtstdatum === 'number') {
        const jsDate = new Date((row.Geburtstdatum - 25569) * 86400 * 1000);
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
    
    const query = {
      Familienname: { $regex: new RegExp(`^${escapeRegex(mapping.Familienname)}`, 'i') },
      Vorname: { $regex: new RegExp(`^${escapeRegex(mapping.VornamePrefix)}`, 'i') },
      _deleted: { $ne: true }
    };
    
    const result = await col.updateMany(query, { $set: updateFields });
    
    if (result.matchedCount > 0) {
      console.log(`✓ ${key} -> ${mapping.Familienname}, ${mapping.VornamePrefix}...: ${result.modifiedCount} aktualisiert`);
      updated += result.modifiedCount;
    } else {
      console.log(`✗ ${key} nicht gefunden`);
    }
  }
  
  console.log(`\n${updated} Schüler aktualisiert`);
  
  await client.close();
}

main().catch(console.error);
