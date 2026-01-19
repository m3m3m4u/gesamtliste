import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const col = client.db().collection('students');

// Suche Kilinc
const kilinc = await col.find({ 
  Familienname: { $regex: 'Kilinc|Kılınç|Kilin', $options: 'i' },
  _deleted: { $ne: true }
}).toArray();
console.log('Kilinc-ähnlich:', kilinc.map(s => `${s.Familienname}, ${s.Vorname}`));

// Suche Mutun
const mutun = await col.find({ 
  Familienname: { $regex: 'Mutun|Mutu', $options: 'i' },
  _deleted: { $ne: true }
}).toArray();
console.log('Mutun-ähnlich:', mutun.map(s => `${s.Familienname}, ${s.Vorname}`));

await client.close();
