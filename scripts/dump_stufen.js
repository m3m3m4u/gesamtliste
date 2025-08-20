#!/usr/bin/env node
// Dump aggregated stufen data for debugging using native mongodb driver
(function(){
  try { require('dotenv').config({ path: '.env.local' }); } catch(e){}
})();
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;
(async ()=>{
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(2); }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection('students');
  const match = { _deleted: { $ne: true } };
  const agg = [
    { $match: match },
    { $group: { _id: { klasse: '$Klasse 25/26', stufe: '$Stufe 25/26', geschlecht: '$Geschlecht', jahr: '$Besuchsjahr' }, count: { $sum: 1 } } }
  ];
  const rows = await col.aggregate(agg).toArray();
  const map = {};
  for (const r of rows) {
    const klasse = r._id.klasse || '—';
    let stufe = r._id.stufe || '—';
    if (stufe === '—' || stufe === '-' || String(stufe).trim() === '') stufe = '0';
    const gesch = (r._id.geschlecht || '').toLowerCase();
    const jahr = r._id.jahr || '—';
    map[klasse] = map[klasse] || { years: {} };
    map[klasse].years[jahr] = map[klasse].years[jahr] || { total:0, m:0, w:0, stufen: {} };
    const cnt = Number(r.count || 0);
    map[klasse].years[jahr].total += cnt;
    if (gesch.startsWith('w')) map[klasse].years[jahr].w += cnt;
    else if (gesch.startsWith('m')) map[klasse].years[jahr].m += cnt;
    map[klasse].years[jahr].stufen[stufe] = map[klasse].years[jahr].stufen[stufe] || { m:0, w:0, total:0 };
    map[klasse].years[jahr].stufen[stufe].total += cnt;
    if (gesch.startsWith('w')) map[klasse].years[jahr].stufen[stufe].w += cnt;
    else if (gesch.startsWith('m')) map[klasse].years[jahr].stufen[stufe].m += cnt;
  }
  // Build allClasses similar to statistik/page.tsx
  const classes = await col.distinct('Klasse 25/26', match) || [];
  const allClasses = Array.from(new Set([ ...classes.map(c=> (c==null? '—': String(c)) ), ...Object.keys(map) ])).filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b)));

  // collect stufen
  const rawStufen = await col.distinct('Stufe 25/26', match) || [];
  const mappedStufen = rawStufen.map(s => { const n = (s==null? '—': String(s)); if (n === '—' || n === '-' || n.trim() === '') return '0'; return n; }).filter(Boolean);
  const stufenSorted = mappedStufen.slice().sort((a,b)=>{ const an=parseInt(a,10), bn=parseInt(b,10); if(!isNaN(an)&&!isNaN(bn)) return an-bn; if(!isNaN(an)) return -1; if(!isNaN(bn)) return 1; return String(a).localeCompare(String(b)); });
  let stufen = Array.from(new Set([ '0', ...stufenSorted.filter(s=>s!=='0') ]));
  stufen = Array.from(new Set([ ...stufen, '8','9' ]));

  // Build aggregatedMap
  const aggregatedMap = {};
  for (const cls of allClasses) {
    aggregatedMap[cls] = { total: 0, m: 0, w: 0, stufen: {} };
    const entry = map[cls] && map[cls].years ? map[cls].years : {};
    for (const y of Object.keys(entry)) {
      const yEntry = entry[y]; if(!yEntry) continue;
      aggregatedMap[cls].total += yEntry.total || 0;
      aggregatedMap[cls].m += yEntry.m || 0;
      aggregatedMap[cls].w += yEntry.w || 0;
      for (const sRaw of Object.keys(yEntry.stufen || {})) {
        const s = (sRaw === '—' || sRaw === '-' || String(sRaw).trim() === '') ? '0' : sRaw;
        if (!aggregatedMap[cls].stufen[s]) aggregatedMap[cls].stufen[s] = { m: 0, w: 0, total: 0 };
        aggregatedMap[cls].stufen[s].total += yEntry.stufen[sRaw].total || 0;
        aggregatedMap[cls].stufen[s].m += yEntry.stufen[sRaw].m || 0;
        aggregatedMap[cls].stufen[s].w += yEntry.stufen[sRaw].w || 0;
      }
    }
    // ensure keys for all stufen exist
    for (const s of stufen) if (!aggregatedMap[cls].stufen[s]) aggregatedMap[cls].stufen[s] = { m:0, w:0, total:0 };
  }

  // print summary for first 20 classes
  const out = { stufen, classes: allClasses.slice(0,50), aggregatedMapSample: {} };
  for (let i=0;i<Math.min(50, allClasses.length); i++) {
    const c = allClasses[i]; out.aggregatedMapSample[c] = aggregatedMap[c];
  }
  console.log(JSON.stringify(out, null, 2));
  await client.close();
  process.exit(0);
})();
