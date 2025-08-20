// Diagnose: Prüft "Passwort"-Feld in der DB
// Usage: node scripts/check_passwords.js

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) dotenv.config();

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

    const base = { _deleted: { $ne: true } };
    const total = await col.countDocuments(base);

    const withPw = await col.countDocuments({
      ...base,
      Passwort: { $exists: true, $ne: null, $type: 'string' }
    });
    const withPwNonEmpty = await col.countDocuments({
      ...base,
      $and: [
        { Passwort: { $exists: true } },
        { Passwort: { $ne: null } },
        { Passwort: { $ne: '' } },
      ]
    });
    const withHash = await col.countDocuments({
      ...base,
      $and: [
        { PasswortHash: { $exists: true } },
        { PasswortHash: { $ne: null } },
        { PasswortHash: { $ne: '' } },
      ]
    });
    const emptyPw = total - withPwNonEmpty;

    console.log('--- Passwort-Diagnose ---');
    console.log('Total aktiv           :', total);
    console.log('mit Passwort (any)    :', withPw);
    console.log('mit Passwort (!= "") :', withPwNonEmpty);
    console.log('mit PasswortHash      :', withHash);
    console.log('leer/fehlend Passwort :', emptyPw);

    const sampleWithPw = await col
      .find({ ...base, Passwort: { $exists: true, $ne: null, $ne: '' } }, { projection: { Benutzername: 1, Passwort: 1, PasswortHash: 1 } })
      .limit(10)
      .toArray();
    console.log('\nBeispiele (mit Passwort):');
    sampleWithPw.forEach(d => console.log({ _id: String(d._id), Benutzername: d.Benutzername, Passwort: d.Passwort, hasHash: !!d.PasswortHash }));

    const sampleHashNoPw = await col
      .find({ ...base, $and: [ { PasswortHash: { $exists: true, $ne: null, $ne: '' } }, { $or: [ { Passwort: { $exists: false } }, { Passwort: null }, { Passwort: '' } ] } ] }, { projection: { Benutzername: 1, Passwort: 1, PasswortHash: 1 } })
      .limit(10)
      .toArray();
    console.log('\nBeispiele (Hash vorhanden, Passwort leer):');
    sampleHashNoPw.forEach(d => console.log({ _id: String(d._id), Benutzername: d.Benutzername, Passwort: d.Passwort, hasHash: !!d.PasswortHash }));

  } catch (e) {
    console.error('Fehler:', e?.message || e);
    process.exit(1);
  } finally {
    await client.close();
  }
})();
