/**
 * Statistik: Wie viele Schüler haben Sokrates ID?
 */

import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const col = client.db('gesamtliste').collection('students');
  
  // Zähle Schüler mit Sokrates ID
  const withId = await col.countDocuments({ 
    'Sokrates ID': { $exists: true, $ne: null, $ne: '' }, 
    _deleted: { $ne: true } 
  });
  const total = await col.countDocuments({ _deleted: { $ne: true } });
  
  console.log(`Schüler mit Sokrates ID: ${withId}`);
  console.log(`Schüler gesamt: ${total}`);
  console.log(`Ohne Sokrates ID: ${total - withId}`);
  
  // Prüfe die speziellen Namen
  console.log('\nSpezielle Namen:');
  const checks = [
    { name: 'Şereş', vorname: 'Mihrimah' },
    { name: 'Lässer', vorname: 'Lene' },
    { name: 'Barati', vorname: 'Nicole' },
    { name: 'Akyildiz', vorname: 'Olgun' },
    { name: 'Choura', vorname: 'Lilia' },
    { name: 'Shoura', vorname: 'Sham' },
    { name: 'Bağlan', vorname: '' },
    { name: 'Resch', vorname: 'Lara' },
  ];
  
  for (const {name, vorname} of checks) {
    const query = { 
      Familienname: { $regex: name, $options: 'i' }, 
      _deleted: { $ne: true } 
    };
    if (vorname) {
      query.Vorname = { $regex: `^${vorname}`, $options: 'i' };
    }
    const found = await col.find(query).project({ Familienname: 1, Vorname: 1, 'Sokrates ID': 1, Geburtsdatum: 1 }).toArray();
    
    found.forEach(f => {
      const hasId = f['Sokrates ID'] ? '✓ ID' : '✗ keine ID';
      const hasBday = f.Geburtsdatum ? '✓ Geb' : '✗ kein Geb';
      console.log(`  ${f.Familienname}, ${f.Vorname}: ${hasId}, ${hasBday}`);
    });
  }
  
  // Finde Schüler ohne Sokrates ID (nur die mit Klasse 25/26)
  console.log('\n\nSchüler MIT Klasse aber OHNE Sokrates ID (aktive Schüler):');
  const ohneId = await col.find({
    'Klasse 25/26': { $exists: true, $regex: /^[ABC]/, $options: 'i' },
    $or: [
      { 'Sokrates ID': { $exists: false } },
      { 'Sokrates ID': null },
      { 'Sokrates ID': '' }
    ],
    _deleted: { $ne: true }
  }).project({ Familienname: 1, Vorname: 1, 'Klasse 25/26': 1 }).sort({ Familienname: 1 }).toArray();
  
  console.log(`Anzahl: ${ohneId.length}`);
  ohneId.forEach(s => console.log(`  ${s['Klasse 25/26']}: ${s.Familienname}, ${s.Vorname}`));
  
  await client.close();
}

main().catch(console.error);
