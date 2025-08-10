import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) {
  dotenv.config();
}
import { MongoClient } from 'mongodb';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI fehlt.');
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const collections = await db.collections();
    for (const c of collections) {
      if (c.collectionName.startsWith('system.')) continue;
      const name = c.collectionName;
      const countBefore = await c.countDocuments();
      if (countBefore === 0) {
        console.log(`Überspringe ${name} (bereits leer).`);
        continue;
      }
      await c.deleteMany({});
      console.log(`Gelöscht: ${name} (vorher ${countBefore}, jetzt 0).`);
    }
    console.log('Alle Collections leer.');
    const verify = await db.collections();
    for (const c of verify) {
      if (c.collectionName.startsWith('system.')) continue;
      const cnt = await c.countDocuments();
      console.log(`Verifikation ${c.collectionName}: ${cnt}`);
    }
  } finally {
    await client.close();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
