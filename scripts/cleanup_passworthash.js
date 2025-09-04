// Entfernt alte PasswortHash Felder dauerhaft
// Usage: node -r dotenv/config scripts/cleanup_passworthash.js

const { MongoClient } = require('mongodb');

(async function(){
  try {
    const uri = process.env.MONGODB_URI;
    if(!uri){
      console.error('MONGODB_URI fehlt – kein Cleanup ausgeführt');
      process.exit(1);
    }
    const client = new MongoClient(uri);
    await client.connect();
    const col = client.db().collection('students');
    const res = await col.updateMany({ PasswortHash: { $exists: true } }, { $unset: { PasswortHash: '' } });
    console.log('PasswortHash Felder entfernt:', res.modifiedCount);
    await client.close();
  } catch(e){
    console.error('Fehler beim Cleanup:', e?.message || e);
    process.exit(2);
  }
})();
