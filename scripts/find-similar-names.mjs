/**
 * Script zum Finden ähnlicher Namen in der Datenbank
 */

import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

const notFound = [
  ['Steinberger', 'Milan'],
  ['Leitner', 'Pia'],
  ['Kluth', 'Noel'],
  ['Hubel', 'Eva'],
  ['Yilmaz', 'Zümra'],
  ['Seres', 'Mihrimah-Seray'],
  ['Dür', 'Vincent'],
  ['Läßer', 'Lene'],
  ['Kainz', 'Paul'],
  ['Kathrein', 'Noa'],
  ['Yilmaz', 'Fatma'],
  ['Djordjević', 'Don'],
  ['Chen', 'Xin'],
  ['Marx', 'Niclas'],
  ['Yalcin', 'Sevval'],
  ['Yurtdas', 'Erva'],
  ['Aye Adnan', 'Kenaan'],
  ['Rau', 'Levian'],
  ['Radovic', 'Anastasia'],
  ['Steinberger', 'Leon'],
  // Rest der 30
  ['Sicari', 'Giorgia'],
  ['Corradetti', 'Matteo'],
  ['Derföldi', 'Leo'],
  ['Gök', 'Eymen'],
  ['Greußing', 'Maximilian'],
  ['Mešić', 'Majda'],
  ['Yıldırım', 'Ömer'],
  ['Gezer', 'Deniz'],
  ['Čejvanović', 'Hana'],
  ['Bağlan', 'Dicle']
];

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('gesamtliste');
  const col = db.collection('students');
  
  console.log('Suche ähnliche Namen in der Datenbank...\n');
  
  for (const [fam, vor] of notFound) {
    // Suche nach ähnlichen Namen (erste 3-4 Buchstaben)
    const famPrefix = fam.substring(0, Math.min(4, fam.length));
    const vorPrefix = vor.substring(0, Math.min(3, vor.length));
    
    const similar = await col.find({
      _deleted: { $ne: true },
      Familienname: { $regex: famPrefix, $options: 'i' }
    }).project({ Familienname: 1, Vorname: 1, 'Klasse 25/26': 1 }).limit(5).toArray();
    
    console.log(`Excel: "${fam}, ${vor}"`);
    if (similar.length > 0) {
      similar.forEach(s => {
        const match = s.Vorname.toLowerCase().startsWith(vorPrefix.toLowerCase()) ? '✓' : ' ';
        console.log(`  ${match} DB: "${s.Familienname}, ${s.Vorname}" (${s['Klasse 25/26'] || '?'})`);
      });
    } else {
      console.log('  (keine ähnlichen gefunden)');
    }
    console.log('');
  }
  
  await client.close();
}

main().catch(console.error);
