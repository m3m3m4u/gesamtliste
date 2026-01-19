/**
 * Prüfen welche Schüler aus der Excel noch keine Sokrates ID in der DB haben
 */

import { MongoClient } from 'mongodb';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const excelPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'aktuelle liste.xlsx');
  const workbook = xlsx.readFile(excelPath);
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const col = client.db('gesamtliste').collection('students');
  
  const missing = [];
  
  for (const row of data) {
    const fam = String(row.Familienname || '').trim();
    const vor = String(row.Vorname || '').trim();
    if (!fam || !vor) continue;
    
    // Suche mit lockerem Matching
    const found = await col.findOne({
      Familienname: { $regex: new RegExp('^' + escapeRegex(fam), 'i') },
      Vorname: { $regex: new RegExp('^' + escapeRegex(vor), 'i') },
      _deleted: { $ne: true },
      'Sokrates ID': { $exists: true, $ne: null, $ne: '' }
    });
    
    if (!found) {
      missing.push(`${fam}, ${vor}`);
    }
  }
  
  console.log(`Noch ohne Sokrates ID: ${missing.length}`);
  if (missing.length > 0) {
    console.log('\nFehlende:');
    missing.forEach(m => console.log(`  - ${m}`));
  }
  
  await client.close();
}

main().catch(console.error);
