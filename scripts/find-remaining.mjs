/**
 * Suche nach verbleibenden 15 Schülern in der Datenbank
 */

import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

const missing = [
  ['Leitner', 'Pia'],
  ['Seres', 'Mihrimah-Seray'],
  ['Läßer', 'Lene'],
  ['Aye Adnan', 'Kenaan'],
  ['Baǧlan', 'Hasan'],
  ['Radovic', 'Anastasia'],
  ['Baǧlan', 'Mir'],
  ['Barati', 'Nicole Katia'],
  ['Akyildiz', 'Olguncan'],
  ['Shoura', 'Lilia'],
  ['Choura', 'Sham'],
  ['Resch', 'Lara'],
  ['Steinegger', 'Patricia'],
  ['Mutun', 'Vera']
];

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const col = client.db('gesamtliste').collection('students');
  
  console.log('Suche in Datenbank...\n');
  
  for (const [fam, vor] of missing) {
    // Versuche verschiedene Schreibweisen
    const famVariants = [fam, fam.replace('ǧ', 'g'), fam.replace('ß', 'ss')];
    
    let found = null;
    for (const famV of famVariants) {
      const results = await col.find({
        _deleted: { $ne: true },
        $or: [
          { Familienname: { $regex: famV.substring(0,3), $options: 'i' } },
        ]
      }).project({ Familienname: 1, Vorname: 1, 'Klasse 25/26': 1, 'Sokrates ID': 1 }).limit(10).toArray();
      
      // Filter nach passendem Vornamen
      const matches = results.filter(r => 
        r.Vorname && r.Vorname.toLowerCase().includes(vor.substring(0,3).toLowerCase())
      );
      
      if (matches.length > 0) {
        found = matches;
        break;
      }
    }
    
    console.log(`Excel: "${fam}, ${vor}"`);
    if (found && found.length > 0) {
      found.forEach(s => {
        const hasId = s['Sokrates ID'] ? '✓ hat ID' : '✗ keine ID';
        console.log(`  DB: "${s.Familienname}, ${s.Vorname}" (${s['Klasse 25/26'] || '?'}) ${hasId}`);
      });
    } else {
      // Breitere Suche
      const all = await col.find({
        _deleted: { $ne: true },
        Vorname: { $regex: vor.substring(0,4), $options: 'i' }
      }).project({ Familienname: 1, Vorname: 1, 'Klasse 25/26': 1 }).limit(5).toArray();
      
      if (all.length > 0) {
        console.log('  Ähnliche Vornamen:');
        all.forEach(s => console.log(`    "${s.Familienname}, ${s.Vorname}" (${s['Klasse 25/26'] || '?'})`));
      } else {
        console.log('  (nicht gefunden)');
      }
    }
    console.log('');
  }
  
  await client.close();
}

main().catch(console.error);
