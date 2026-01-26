/**
 * Aktualisiere Geburtsdaten für Schüler mit Zweitnamen
 */

import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'gesamtliste';

// Mapping: DB-Name → Excel-Datum
const updates = [
  { familienname: 'Dür', vorname: 'Vincent Wotan', geburtsdatum: '2013-05-20' },
  { familienname: 'Kainz', vorname: 'Paul Gabriel', geburtsdatum: '2015-06-05' },
  { familienname: 'Yilmaz', vorname: 'Fatma Nesil', geburtsdatum: '2013-07-18' },
  { familienname: 'Bahl', vorname: 'Ilva Sophie', geburtsdatum: '2012-05-30' },
  { familienname: 'Brun', vorname: 'Maximilian Salvatore', geburtsdatum: '2011-06-29' },
  { familienname: 'Gutschi', vorname: 'Sarah Marie', geburtsdatum: '2012-06-27' },
  { familienname: 'Hartmann', vorname: 'Annalena Sophia', geburtsdatum: '2012-03-16' },
  { familienname: 'Lässer', vorname: 'Lotta Luisa Marie', geburtsdatum: '2012-12-05' },
  { familienname: 'Rak', vorname: 'Kevin Noel', geburtsdatum: '2012-06-25' },
  { familienname: 'Waltersdorfer', vorname: 'Maria Viktoria', geburtsdatum: '2012-06-07' },
  { familienname: 'Wohlgenannt', vorname: 'Lea Fayola', geburtsdatum: '2012-10-25' },
  { familienname: 'Wurzenrainer', vorname: 'Jana Valentina', geburtsdatum: '2011-09-17' },
  { familienname: 'Al Bukeirat', vorname: 'Ibrahim', geburtsdatum: '2011-01-01' }, // Al Bkerat → Al Bukeirat
  { familienname: 'Shoura', vorname: 'Sham', geburtsdatum: '2012-01-09' }, // Choura → Shoura
];

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('Mit MongoDB verbunden\n');
  
  const db = client.db(DB_NAME);
  const collection = db.collection('students');
  
  let updated = 0;
  
  for (const u of updates) {
    const result = await collection.updateMany(
      { 
        $or: [
          { Familienname: u.familienname, Vorname: u.vorname },
          { Nachname: u.familienname, Vorname: u.vorname },
          { 
            Familienname: { $regex: new RegExp(`^${u.familienname}$`, 'i') }, 
            Vorname: { $regex: new RegExp(`^${u.vorname}$`, 'i') } 
          }
        ]
      },
      { $set: { Geburtsdatum: u.geburtsdatum } }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`✅ ${u.familienname} ${u.vorname} -> ${u.geburtsdatum} (${result.modifiedCount} aktualisiert)`);
      updated += result.modifiedCount;
    } else {
      // Nochmal prüfen ob schon korrekt
      const student = await collection.findOne({
        $or: [
          { Familienname: u.familienname, Vorname: u.vorname },
          { Familienname: { $regex: new RegExp(`^${u.familienname}$`, 'i') }, Vorname: { $regex: new RegExp(`^${u.vorname}$`, 'i') } }
        ]
      });
      if (student) {
        console.log(`ℹ️  ${u.familienname} ${u.vorname} - bereits korrekt: ${student.Geburtsdatum}`);
      } else {
        console.log(`❌ ${u.familienname} ${u.vorname} - nicht gefunden`);
      }
    }
  }
  
  console.log(`\n✅ Gesamt aktualisiert: ${updated}`);
  
  await client.close();
}

main().catch(console.error);
