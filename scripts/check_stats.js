// Vergleichsskript: zeigt Summen pro Klasse (alle Jahre) vs. nur letzte 2 Jahre
// Usage: node scripts/check_stats.js

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) dotenv.config();

(async ()=>{
  const uri = process.env.MONGODB_URI;
  if(!uri){ console.error('MONGODB_URI fehlt'); process.exit(2); }
  const client = new MongoClient(uri);
  await client.connect();
  try{
    const col = client.db().collection('students');
    const match = { _deleted: { $ne: true } };
    // All years aggregation (legacy)
    const aggAll = [
      { $match: match },
      { $group: { _id: { klasse: '$Klasse 25/26', geschlecht: '$Geschlecht' }, count: { $sum: 1 } } },
      { $sort: { '_id.klasse': 1 } }
    ];
    const all = await col.aggregate(aggAll).toArray();
    // Last two years:
    const years = await col.distinct('Besuchsjahr', match);
    const ys = (years || []).map(y=>y==null?null:String(y)).filter(Boolean).sort();
    const last2 = ys.slice(-2);
    const aggLast2 = [
      { $match: Object.assign({}, match, { Besuchsjahr: { $in: last2 } }) },
      { $group: { _id: { klasse: '$Klasse 25/26', geschlecht: '$Geschlecht' }, count: { $sum: 1 } } },
      { $sort: { '_id.klasse': 1 } }
    ];
    const l2 = await col.aggregate(aggLast2).toArray();

    // Build map for nicer print
    const mapAll = {};
    for(const r of all){
      const k = r._id.klasse || '—';
      const g = (r._id.geschlecht||'').toLowerCase();
      if(!mapAll[k]) mapAll[k] = { total:0, w:0, m:0 };
      mapAll[k].total += r.count||0;
      if(g.startsWith('w')) mapAll[k].w += r.count||0;
      else if(g.startsWith('m')) mapAll[k].m += r.count||0;
    }
    const mapL2 = {};
    for(const r of l2){
      const k = r._id.klasse || '—';
      const g = (r._id.geschlecht||'').toLowerCase();
      if(!mapL2[k]) mapL2[k] = { total:0, w:0, m:0 };
      mapL2[k].total += r.count||0;
      if(g.startsWith('w')) mapL2[k].w += r.count||0;
      else if(g.startsWith('m')) mapL2[k].m += r.count||0;
    }

    console.log('Found years:', ys.join(', '));
    console.log('\nClass | All_total | All_w | All_m || Last2_total | Last2_w | Last2_m');
    const classes = Array.from(new Set([...Object.keys(mapAll), ...Object.keys(mapL2)])).sort();
    for(const c of classes){
      const a = mapAll[c] || { total:0,w:0,m:0 };
      const b = mapL2[c] || { total:0,w:0,m:0 };
      console.log(`${c} | ${a.total} | ${a.w} | ${a.m} || ${b.total} | ${b.w} | ${b.m}`);
    }

  } finally { await client.close(); }
})();
