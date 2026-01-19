#!/usr/bin/env node
/**
 * Suche nach nicht gefundenen Schülern mit abweichenden Schreibweisen
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const col = client.db().collection('students');
  
  const names = [
    ['Maggioni', 'Mikail'],
    ['Yalcin', 'Asya'],
    ['Lässer', 'Lotta'],
    ['Sezer', 'Ishak'],
    ['Vrinic', 'Darko'],
    ['Wohlgenannt', 'Lea'],
    ['Akan', 'Muhammet'],
    ['Demirtas', 'Tugba'],
    ['Al Bukeirat', 'Ibrahim'],
    ['Dimitric', 'Luka'],
    ['Djordjevic', 'Shayenne'],
    ['Kilinc', 'Anil'],
    ['Cinar', 'Ela'],
    ['Kis', 'Leo'],
    ['Miljkovic', 'Tamara'],
    ['Mutun', 'Vera'],
    ['Yilmaz', 'Bugra'],
    ['Baĝlan', 'Dicle'],
    ['Dolic', 'Laya']
  ];
  
  for (const [fam, vor] of names) {
    // Suche mit Teilstring
    const famPart = fam.substring(0, Math.min(4, fam.length));
    const vorPart = vor.substring(0, Math.min(3, vor.length));
    
    const found = await col.findOne({
      Familienname: { $regex: famPart, $options: 'i' },
      Vorname: { $regex: vorPart, $options: 'i' },
      _deleted: { $ne: true }
    });
    
    if (found) {
      console.log(`Excel: ${fam}, ${vor}`);
      console.log(`   DB: ${found.Familienname}, ${found.Vorname}`);
    } else {
      console.log(`Excel: ${fam}, ${vor} => NICHT GEFUNDEN`);
    }
  }
  
  await client.close();
}

main().catch(console.error);
