scheinimport dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) dotenv.config();
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI fehlt (.env.local oder .env)');
  process.exit(1);
}

const limitGroups = parseInt(process.env.DEDUP_LIMIT || '20', 10);

function trimLower(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : null;
}

function shortDate(s) {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  // Nimmt YYYY-MM-DD aus "YYYY-MM-DD 00:00:00" heraus
  const m = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/.exec(t);
  return m ? m[1] : t;
}

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const col = db.collection('students');

    const results = {};

    // 1) Doppelte nach NormBenutzername
    results.byNormUser = await col.aggregate([
      { $match: { NormBenutzername: { $type: 'string' }, $or: [ { _deleted: { $exists: false } }, { _deleted: { $ne: true } } ] } },
      { $group: { _id: '$NormBenutzername', count: { $sum: 1 }, ids: { $push: '$_id' }, users: { $push: '$Benutzername' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limitGroups }
    ]).toArray();

    // 2) Doppelte nach Benutzername (falls NormBenutzername fehlt/inkonsistent)
    results.byUser = await col.aggregate([
      { $match: { Benutzername: { $type: 'string' }, $or: [ { _deleted: { $exists: false } }, { _deleted: { $ne: true } } ] } },
      { $group: { _id: { $toLower: { $trim: { input: '$Benutzername' } } }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limitGroups }
    ]).toArray();

    // 3) Doppelte ohne NormBenutzername: Name + Geburtsdatum
    results.byNameDob = await col.aggregate([
      { $match: { $and: [ { $or: [ { NormBenutzername: { $exists: false } }, { NormBenutzername: null } ] }, { $or: [ { _deleted: { $exists: false } }, { _deleted: { $ne: true } } ] } ] } },
      { $project: {
          vn: { $toLower: { $ifNull: [ { $trim: { input: '$Vorname' } }, '' ] } },
          fn: { $toLower: { $ifNull: [ { $trim: { input: '$Familienname' } }, '' ] } },
          bd: { $ifNull: [ { $substrBytes: [ { $ifNull: [ '$Geburtsdatum', '' ] }, 0, 10 ] }, '' ] }
        }
      },
  { $group: { _id: { vn: '$vn', fn: '$fn', bd: '$bd' }, count: { $sum: 1 } } },
  { $match: { '_id.vn': { $ne: '' }, '_id.fn': { $ne: '' }, count: { $gt: 1 } } },
      { $sort: { count: -1, '_id.fn': 1, '_id.vn': 1 } },
      { $limit: limitGroups }
    ]).toArray();

    // 4) Doppelte ohne NormBenutzername: Name + Klasse 25/26 (Heuristik)
    results.byNameClass = await col.aggregate([
      { $match: { $and: [ { $or: [ { NormBenutzername: { $exists: false } }, { NormBenutzername: null } ] }, { $or: [ { _deleted: { $exists: false } }, { _deleted: { $ne: true } } ] } ] } },
      { $project: {
          vn: { $toLower: { $ifNull: [ { $trim: { input: '$Vorname' } }, '' ] } },
          fn: { $toLower: { $ifNull: [ { $trim: { input: '$Familienname' } }, '' ] } },
          cls: { $toLower: { $ifNull: [ { $trim: { input: '$25/26' } }, '' ] } }
        }
      },
  { $group: { _id: { vn: '$vn', fn: '$fn', cls: '$cls' }, count: { $sum: 1 } } },
  { $match: { '_id.vn': { $ne: '' }, '_id.fn': { $ne: '' }, count: { $gt: 1 } } },
      { $sort: { count: -1, '_id.fn': 1, '_id.vn': 1 } },
      { $limit: limitGroups }
    ]).toArray();

    // Ausgabe
    const totalDupNorm = results.byNormUser.length;
    const totalDupUser = results.byUser.length;
    const totalDupNameDob = results.byNameDob.length;
    const totalDupNameClass = results.byNameClass.length;

    console.log('Duplikats-Check (Top-Gruppen):');
    console.log('1) NormBenutzername:', totalDupNorm, 'Gruppen');
    for (const g of results.byNormUser) {
      console.log('  -', g._id, 'x', g.count);
    }
    console.log('2) Benutzername:', totalDupUser, 'Gruppen');
    for (const g of results.byUser) {
      console.log('  -', g._id, 'x', g.count);
    }
    console.log('3) Name+Geburtsdatum (ohne NormBenutzername):', totalDupNameDob, 'Gruppen');
    for (const g of results.byNameDob) {
      console.log('  -', `${g._id.fn.toUpperCase()}, ${g._id.vn} | ${g._id.bd} x ${g.count}`);
    }
    console.log('4) Name+Klasse 25/26 (ohne NormBenutzername):', totalDupNameClass, 'Gruppen');
    for (const g of results.byNameClass) {
      console.log('  -', `${g._id.fn.toUpperCase()}, ${g._id.vn} | Klasse ${g._id.cls} x ${g.count}`);
    }

  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error('Fehler beim Duplikats-Check:', err);
  process.exit(1);
});
