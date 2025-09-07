import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) dotenv.config();
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI fehlt'); process.exit(1); }

// Nutzung:
// 1) node scripts/restore-from-trash.mjs reason="trash-by-class: A,o,V,W,w"
// 2) node scripts/restore-from-trash.mjs ids=<comma-separated trashIds>

const args = Object.fromEntries(process.argv.slice(2).map(a=>{
  const i = a.indexOf('=');
  if (i === -1) return [a, true];
  return [a.slice(0,i), a.slice(i+1)];
}));

async function run(){
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const students = db.collection('students');
    const trash = db.collection('students_trash');

    let q = null;
    if (args.reason) q = { reason: String(args.reason) };
    else if (args.ids) {
      const ids = String(args.ids).split(',').map(s=>s.trim()).filter(Boolean).map(s=>new ObjectId(s));
      q = { _id: { $in: ids } };
    }
    if (!q) { console.error('Bitte reason=... oder ids=... angeben'); process.exit(1); }

    const items = await trash.find(q).toArray();
    console.log('Trash-Einträge:', items.length);
    if (!items.length) return;

    const ops = [];
    for (const t of items) {
      const id = t.originalId;
      ops.push({ updateOne: { filter: { _id: new ObjectId(id) }, update: { $set: { _deleted: false }, $unset: { deletedAt: '', deletedBy: '', deletedReason: '', _trashId: '' } } } });
    }
    const res = await students.bulkWrite(ops, { ordered: false });
    console.log('Restored:', res.modifiedCount);
  } finally {
    await client.close();
  }
}

run().catch(err=>{ console.error('Fehler restore-from-trash:', err); process.exit(1); });
