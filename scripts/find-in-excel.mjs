/**
 * Suche die 17 fehlenden Schüler in der Excel-Datei mit lockerem Matching
 */

import { MongoClient } from 'mongodb';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

const missing = [
  ['Braito', 'Giuliana'],
  ['Kloser', 'Lara'],
  ['Kulosman', 'Sara'],
  ['Lässer', 'Lotta Luisa Marie'],
  ['Popesku', 'Pavlo'],
  ['Rath', 'Noa Marie'],
  ['Schmid', 'Samuel'],
  ['Schuchter', 'Faruk'],
  ['Simma', 'Josie Ann'],
  ['Suliga', 'Szymon'],
  ['Suliga', 'Hanna'],
  ['Sulz', 'Lena'],
  ['Tas', 'Baran'],
  ['Todorović', 'Kevin Filip'],
  ['Vossenkuhl', 'Ella'],
  ['Wohlgenannt', 'Lea Fayola'],
  ['Yalcin', 'Asya Belinay']
];

async function main() {
  const excelPath = path.join(__dirname, '..', 'public', 'Vorlagen', 'aktuelle liste.xlsx');
  const workbook = xlsx.readFile(excelPath);
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
  console.log(`Excel hat ${data.length} Einträge\n`);
  console.log('Suche fehlende Schüler in der Excel...\n');
  
  for (const [dbFam, dbVor] of missing) {
    console.log(`DB: "${dbFam}, ${dbVor}"`);
    
    // Suche nach ähnlichem Familiennamen (erste 3-4 Buchstaben)
    const famPrefix = dbFam.substring(0, Math.min(4, dbFam.length)).toLowerCase();
    const vorPrefix = dbVor.substring(0, Math.min(3, dbVor.length)).toLowerCase();
    
    const matches = data.filter(row => {
      const fam = String(row.Familienname || '').toLowerCase();
      const vor = String(row.Vorname || '').toLowerCase();
      
      // Prüfe verschiedene Matching-Strategien
      return (
        fam.startsWith(famPrefix) ||
        fam.includes(famPrefix) ||
        (vor.startsWith(vorPrefix) && fam.length > 2)
      );
    });
    
    // Filtere nochmal nach besserem Match
    const goodMatches = matches.filter(row => {
      const fam = String(row.Familienname || '').toLowerCase();
      const vor = String(row.Vorname || '').toLowerCase();
      return fam.startsWith(famPrefix) || vor.startsWith(vorPrefix);
    });
    
    if (goodMatches.length > 0) {
      goodMatches.slice(0, 3).forEach(m => {
        console.log(`  Excel: "${m.Familienname}, ${m.Vorname}"`);
      });
    } else {
      console.log('  (nicht in Excel gefunden)');
    }
    console.log('');
  }
}

main().catch(console.error);
