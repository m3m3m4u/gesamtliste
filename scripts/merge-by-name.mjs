import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) dotenv.config();
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI fehlt');
  process.exit(1);
}

const [,, vornameArg, familiennameArg] = process.argv;
if (!vornameArg || !familiennameArg) {
  console.error('Aufruf: node scripts/merge-by-name.mjs "Vorname" "Familienname"');
  process.exit(1);
}

const toLowerTrim = s => (typeof s === 'string' ? s.trim().toLowerCase() : '');

function scoreDoc(d) {
  const skip = new Set(['_id','createdAt','updatedAt','NormBenutzername','_deleted','mergedInto']);
  let s = 0;
  for (const k of Object.keys(d)) {
    if (skip.has(k)) continue;
    const v = d[k];
    if (v == null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    s += 1;
  }
  if (d.updatedAt) s += 0.5;
  return s;
}

function mergeDocs(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    if (['_id','createdAt','updatedAt','NormBenutzername','_deleted','mergedInto','ImportStamp'].includes(k)) continue;
    if (k.includes('.') || k.startsWith('$')) continue;
    if (out[k] == null || (typeof out[k] === 'string' && out[k].trim() === '')) out[k] = v;
    else if (Array.isArray(out[k]) && Array.isArray(v)) out[k] = Array.from(new Set([...out[k], ...v]));
  }
  const disp = out['Klasse 25/26'];
  const canon = out['25/26'];
  const cls = (typeof disp === 'string' && disp.trim()) || (typeof canon === 'string' && canon.trim()) || null;
  if (cls) { out['Klasse 25/26'] = cls; out['25/26'] = cls; }
  return out;
}

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const col = db.collection('students');
    const vn = toLowerTrim(vornameArg);
    const fn = toLowerTrim(familiennameArg);
    const docs = await col.find({
      $and: [
        { $expr: { $eq: [ { $toLower: { $trim: { input: '$Vorname' } } }, vn ] } },
        { $expr: { $eq: [ { $toLower: { $trim: { input: '$Familienname' } } }, fn ] } },
        { $or: [ { NormBenutzername: { $exists: false } }, { NormBenutzername: null } ] },
        { $or: [ { _deleted: { $exists: false } }, { _deleted: { $ne: true } } ] }
      ]
    }).toArray();
    console.log('Gefunden:', docs.length);
    if (docs.length <= 1) return;
    const sorted = docs.slice().sort((a,b)=>{
      const sa=scoreDoc(a), sb=scoreDoc(b);
      if (sb!==sa) return sb-sa;
      const ua=a.updatedAt?new Date(a.updatedAt).getTime():0;
      const ub=b.updatedAt?new Date(b.updatedAt).getTime():0;
      if (ub!==ua) return ub-ua;
      return String(a._id).localeCompare(String(b._id));
    });
    const winner = sorted[0];
    const losers = sorted.slice(1);
    let merged = { ...winner };
    for (const l of losers) merged = mergeDocs(merged, l);
    const set = {};
    for (const [k,v] of Object.entries(merged)) {
      if (['_id','createdAt','updatedAt','NormBenutzername','_deleted','mergedInto','ImportStamp'].includes(k)) continue;
      if (k.includes('.') || k.startsWith('$')) continue;
      if (winner[k] !== v) set[k] = v;
    }
    const ops = [];
    if (Object.keys(set).length) {
      set.updatedAt = new Date();
      ops.push({ updateOne: { filter: { _id: new ObjectId(winner._id) }, update: { $set: set } } });
    }
    for (const l of losers) {
      ops.push({ updateOne: { filter: { _id: new ObjectId(l._id) }, update: { $set: { _deleted: true, mergedInto: winner._id, dedupAt: new Date() } } } });
    }
    if (ops.length) {
      const res = await col.bulkWrite(ops, { ordered: false });
      console.log('Merged. modified:', res.modifiedCount, 'matched:', res.matchedCount);
    }
  } finally {
    await client.close();
  }
}

run().catch(err=>{ console.error('Fehler:', err); process.exit(1); });
