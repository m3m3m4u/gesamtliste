// Fills missing Passwort fields and creates PasswortHash where missing
// Usage:
//  node scripts/fill_passwords.js --dry-run      # show what would be changed
//  node scripts/fill_passwords.js --apply        # actually update documents
// Environment: set MONGODB_URI in .env.local or .env

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) dotenv.config();

const argv = require('minimist')(process.argv.slice(2));
const DRY = argv['dry-run'] || !argv.apply;
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const PASSWORD_LENGTH = Number(process.env.FILL_PASS_LEN || 8);

function genPassword(len) {
  // URL-safe base64 then slice
  return crypto.randomBytes(Math.ceil(len * 3 / 4)).toString('base64').replace(/[+/=]/g, '').slice(0, len);
}

(async function main(){
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI fehlt in .env.local oder .env');
    process.exit(2);
  }
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const col = db.collection('students');
    // Find documents where Passwort is null, undefined, or empty string
    const query = { $or: [ { Passwort: { $exists: false } }, { Passwort: null }, { Passwort: '' } ] };
    const cursor = col.find(query).project({ Benutzername: 1, Passwort: 1 }).limit(1000);
    const toUpdate = [];
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const pwd = genPassword(PASSWORD_LENGTH);
      const hash = bcrypt.hashSync(pwd, SALT_ROUNDS);
      toUpdate.push({ _id: doc._id, Benutzername: doc.Benutzername || null, Passwort: pwd, PasswortHash: hash });
    }
    console.log(`Found ${toUpdate.length} documents with missing/empty Passwort (preview up to 1000).`);
    if (toUpdate.length === 0) return;
    if (DRY) {
      console.log('Dry-run mode: the following updates would be applied (first 20 shown):');
      toUpdate.slice(0,20).forEach(x => console.log(JSON.stringify({ _id: String(x._id), Benutzername: x.Benutzername, newPasswort: x.Passwort }))); 
      console.log('\nRun with --apply to actually perform updates. Make a DB backup beforehand.');
      return;
    }
    console.log('Applying updates...');
    let updated = 0;
    for (const u of toUpdate) {
      const res = await col.updateOne({ _id: u._id }, { $set: { Passwort: u.Passwort, PasswortHash: u.PasswortHash, updatedAt: new Date() } });
      if (res.modifiedCount === 1) updated++;
    }
    console.log(`Updated ${updated} documents.`);
    console.log('Done.');
  } finally {
    await client.close();
  }
})().catch(err => { console.error('Error:', err); process.exit(1); });
