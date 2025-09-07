import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) dotenv.config();
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI fehlt (.env.local oder .env)');
  process.exit(1);
}

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const NOW = new Date();

const isEmpty = (v) => v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
const normStr = (v) => (typeof v === 'string' ? v.trim() : v);
const lower = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const shortDate = (v) => {
  if (!v) return '';
  const s = String(v).trim();
  const m = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/.exec(s);
  return m ? m[1] : '';
};

function scoreDoc(d) {
  // einfache Heuristik: Anzahl nicht-leerer Felder (exkl. Metafelder), plus Bonus für updatedAt
  const skip = new Set(['_id', 'createdAt', 'updatedAt', 'NormBenutzername', '_deleted', 'mergedInto']);
  let s = 0;
  for (const k of Object.keys(d)) {
    if (skip.has(k)) continue;
    if (!isEmpty(d[k])) s += 1;
  }
  if (d.updatedAt) s += 0.5;
  return s;
}

function mergeDocs(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    if (['_id', 'createdAt', 'updatedAt', 'NormBenutzername', '_deleted', 'mergedInto', 'ImportStamp'].includes(k)) continue;
    if (isEmpty(out[k]) && !isEmpty(v)) {
      out[k] = v;
    } else if (Array.isArray(out[k]) && Array.isArray(v)) {
      const set = new Set([...out[k], ...v]);
      out[k] = Array.from(set);
    }
  }
  // Klassenfelder spiegeln (Anzeige-Feld gewinnt)
  const disp = normStr(out['Klasse 25/26']);
  const canon = normStr(out['25/26']);
  const cls = disp || canon || null;
  if (cls) {
    out['Klasse 25/26'] = cls;
    out['25/26'] = cls;
  }
  return out;
}

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const col = db.collection('students');

    // 0) Benutzername '' -> null normalisieren
    const normRes = await col.updateMany({ Benutzername: '' }, { $set: { Benutzername: null } });
    if (normRes.modifiedCount) {
      console.log('Benutzername leere Strings normalisiert:', normRes.modifiedCount);
    }

    // 1) Kandidaten laden (ohne NormBenutzername, nicht gelöscht)
    const cursor = col.find({ $and: [
      { $or: [ { NormBenutzername: { $exists: false } }, { NormBenutzername: null } ] },
      { $or: [ { _deleted: { $exists: false } }, { _deleted: { $ne: true } } ] }
    ]});
    const docs = await cursor.toArray();
    console.log('Kandidaten ohne NormBenutzername:', docs.length);

    // 2) Gruppierung: Zuerst Name+Geburtsdatum, sonst Name+Klasse, zuletzt Name-only
    const groups = new Map();
    for (const d of docs) {
      const vn = lower(d.Vorname);
      const fn = lower(d.Familienname);
      const bd = shortDate(d.Geburtsdatum);
      const cls = lower(d['25/26'] || d['Klasse 25/26'] || '');
      if (!vn || !fn) continue; // ohne Namen nicht gruppieren
      let key = null;
      if (bd) key = `dob|${fn}|${vn}|${bd}`;
      else if (cls) key = `cls|${fn}|${vn}|${cls}`;
      else key = `name|${fn}|${vn}`; // letzte Eskalation: Name-only
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }

    let groupsTotal = 0;
    let mergedGroups = 0;
    const bulkOps = [];

    for (const [key, arr] of groups.entries()) {
      if (arr.length <= 1) continue;
      groupsTotal++;
      // Gewinner bestimmen
      const sorted = arr.slice().sort((a, b) => {
        const sa = scoreDoc(a);
        const sb = scoreDoc(b);
        if (sb !== sa) return sb - sa;
        const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        if (ub !== ua) return ub - ua;
        return String(a._id).localeCompare(String(b._id));
      });
      const winner = sorted[0];
      const losers = sorted.slice(1);

      // Merge-Felder vorbereiten
      let mergedDoc = { ...winner };
      for (const l of losers) {
        mergedDoc = mergeDocs(mergedDoc, l);
      }
      const winnerSet = {};
      for (const [k, v] of Object.entries(mergedDoc)) {
        if (['_id', 'createdAt', 'updatedAt', 'NormBenutzername', '_deleted', 'mergedInto', 'ImportStamp'].includes(k)) continue;
        // Felder mit Punkt oder $ im Key auslassen (verursachen Konflikte/ungültige Pfade)
        if (k.includes('.') || k.startsWith('$')) continue;
        if (winner[k] !== v) winnerSet[k] = v;
      }
      if (Object.keys(winnerSet).length) {
        winnerSet.updatedAt = NOW;
        bulkOps.push({ updateOne: { filter: { _id: new ObjectId(winner._id) }, update: { $set: winnerSet } } });
      }
      for (const l of losers) {
        bulkOps.push({ updateOne: { filter: { _id: new ObjectId(l._id) }, update: { $set: { _deleted: true, mergedInto: winner._id, dedupAt: NOW } } } });
      }
      mergedGroups++;
    }

    console.log('Gefundene Mehrfach-Gruppen:', groupsTotal);
    console.log('Zu mergen (Gruppen):', mergedGroups, 'Updates:', bulkOps.length);

    if (!DRY_RUN && bulkOps.length) {
      const res = await col.bulkWrite(bulkOps, { ordered: false });
      console.log('BulkWrite:', JSON.stringify({ modified: res.modifiedCount, upserts: res.upsertedCount, matched: res.matchedCount }, null, 2));
    } else if (DRY_RUN) {
      console.log('DRY_RUN aktiv – keine Änderungen geschrieben.');
    }

  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error('Fehler beim Dedup:', err);
  process.exit(1);
});
