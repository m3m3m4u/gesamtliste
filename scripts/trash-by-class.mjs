import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) dotenv.config();
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI fehlt'); process.exit(1); }

// Nutzung: node scripts/trash-by-class.mjs [A,o,V,W,w]
const args = process.argv.slice(2);
const classList = (args[0] ? args[0].split(',') : ['A','o','V','W','w']).map(s=>s.trim()).filter(Boolean);
const classSet = new Set(classList.map(s=>s.toLowerCase()));
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

const now = new Date();
const REASON = `trash-by-class: ${classList.join(',')}`;

function normClass(d){
  const v = d['25/26'] ?? d['Klasse 25/26'] ?? '';
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

async function run(){
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const col = db.collection('students');
    const trash = db.collection('students_trash');

    // Kandidaten laden (aktiv, mit Klassenfeld)
    const candidates = await col.find({
      $and: [
        { $or: [ { _deleted: { $exists: false } }, { _deleted: { $ne: true } } ] },
        { $or: [ { '25/26': { $type: 'string' } }, { 'Klasse 25/26': { $type: 'string' } } ] }
      ]
    }).toArray();

    const targets = candidates.filter(d => classSet.has(normClass(d)));
    console.log('Kandidaten gesamt:', candidates.length, '| Treffer:', targets.length, '| Klassen:', classList.join(','));
    if (targets.length === 0) return;

    // In Trash-Collection kopieren (Snapshot + Metadaten)
    const trashDocs = targets.map(d => ({
      originalId: d._id,
      snapshot: d,
      reason: REASON,
      trashedAt: now,
      trashedBy: 'script:trash-by-class'
    }));
    let insertedIds = {};
    if (!DRY_RUN) {
      const ins = await trash.insertMany(trashDocs, { ordered: false });
      insertedIds = ins.insertedIds; // index -> ObjectId
    } else {
      console.log('[DRY_RUN] Würde in students_trash einfügen:', trashDocs.length);
    }

    // Originale markieren (_deleted + Verweis auf Trash)
    const bulkOps = [];
    for (let i = 0; i < targets.length; i++) {
      const d = targets[i];
      const trashId = insertedIds[i] || null;
      bulkOps.push({
        updateOne: {
          filter: { _id: new ObjectId(d._id) },
          update: { $set: { _deleted: true, deletedAt: now, deletedBy: 'script:trash-by-class', deletedReason: REASON, _trashId: trashId } }
        }
      });
    }
    if (!DRY_RUN) {
      const res = await col.bulkWrite(bulkOps, { ordered: false });
      console.log('Soft-Deleted:', res.modifiedCount, 'von', bulkOps.length);
    } else {
      console.log('[DRY_RUN] Würde Soft-Delete ausführen für:', bulkOps.length);
    }
  } finally {
    await client.close();
  }
}

run().catch(err=>{ console.error('Fehler trash-by-class:', err); process.exit(1); });
