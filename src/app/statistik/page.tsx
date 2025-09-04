import React from 'react';
import clientPromise from '@/lib/mongodb';
import StatistikClient from './StatistikClient';
import BackLink from './BackLink';

function normalizeKey(v: unknown) {
  if (v === null || v === undefined) return '—';
  return String(v);
}

function sortStufen(arr: string[]) {
  // try numeric sort when possible, fallback to string
  return arr.slice().sort((a,b)=>{
    const an = parseInt(a,10); const bn = parseInt(b,10);
    if (!isNaN(an) && !isNaN(bn)) return an - bn;
    if (!isNaN(an)) return -1; if (!isNaN(bn)) return 1;
    return String(a).localeCompare(String(b));
  });
}

export default async function StatistikPage() {
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('students');

  const match = { _deleted: { $ne: true } };

  // distinct Klassen (primär aus 'Klasse 25/26', Fallback auf Legacy-Felder falls nötig)
  let classes = await col.distinct('Klasse 25/26', match) as string[];
  if (!classes || classes.filter(c=>c && String(c).trim()).length <= 1) {
    const altFields = ['Klasse','25/26','Klasse25','Klasse26','Klasse 24/25','Klasse 24/25_1'];
    const extra: string[] = [];
    for (const f of altFields) {
      try {
        const vals = await col.distinct(f, match);
        for (const v of vals as unknown[]) {
          const s = String(v ?? '').trim();
          if (s) extra.push(s);
        }
      } catch {}
    }
    classes = Array.from(new Set([...(classes||[]).map(c=>String(c||'').trim()).filter(Boolean), ...extra]));
  }
  // Stufen inkl. Fallback auf Vorjahresfelder sammeln
  let rawStufen = await col.distinct('Stufe 25/26', match) as string[];
  if (!rawStufen || rawStufen.filter(s=>String(s??'').trim()).length === 0) {
    const altStufeFields = ['Stufe 24/25','Stufe 24/25_1'];
    const extra: string[] = [];
    for (const f of altStufeFields) {
      try {
        const vals = await col.distinct(f, match);
        for (const v of vals as unknown[]) {
          const s = String(v ?? '').trim();
          if (s) extra.push(s);
        }
      } catch {}
    }
    rawStufen = Array.from(new Set([...(rawStufen||[]), ...extra]));
  }
  const rawYears = await col.distinct('Besuchsjahr', match) as string[];
  // map any empty/placeholder stufe ('-', '—' or null) to '0' and ensure '0' is first
  const mappedStufen = rawStufen.map(s => {
    const n = normalizeKey(s);
    if (n === '—' || n === '-' || n.trim() === '') return '0';
    return n;
  }).filter(Boolean);
  const stufenSorted = sortStufen(mappedStufen);
  // ensure '0' (unknown) is leftmost
  let stufen = Array.from(new Set([ '0', ...stufenSorted.filter(s => s !== '0') ]));
  // ensure commonly expected stufen exist even if no data: 8 and 9
  stufen = Array.from(new Set([ ...stufen, '8', '9' ]));
  const yearsNormalized = rawYears.map(y=>normalizeKey(y)).filter(Boolean);
  // Build all years list: prefer numeric sort if possible
  const numericYears = yearsNormalized.map(v => { const n = parseInt(v,10); return isNaN(n) ? null : n; }).filter(n=>n!=null) as number[];
  let yearsAll: string[] = [];
  if (numericYears.length) {
    yearsAll = Array.from(new Set(numericYears.sort((a,b)=>a-b).map(String)));
  } else {
    yearsAll = Array.from(new Set(yearsNormalized.sort()));
  }

  // Aggregate counts by kanonischer klasse / stufe / geschlecht / jahr
  const agg = [
    { $match: match },
    { $addFields: {
      _canonKlasse: {
        $let: {
          vars: {
            a: '$Klasse 25/26', b: '$Klasse', c: '$25/26', d: '$Klasse25', e: '$Klasse26', f: '$Klasse 24/25', g: '$Klasse 24/25_1'
          },
          in: {
            $ifNull: ['$$a', { $ifNull: ['$$b', { $ifNull: ['$$c', { $ifNull: ['$$d', { $ifNull: ['$$e', { $ifNull: ['$$f', '$$g'] }] }] }] }] }]
          }
        }
      },
      _canonStufe: {
        $let: {
          vars: { s1: '$Stufe 25/26', s2: '$Stufe 24/25', s3: '$Stufe 24/25_1' },
          in: {
            $let: {
              vars: { raw: { $ifNull: ['$$s1', { $ifNull: ['$$s2', '$$s3'] }] } },
              in: {
                $cond: [
                  { $or: [ { $eq: ['$$raw', null] }, { $eq: ['$$raw',''] }, { $eq: ['$$raw','-'] }, { $eq: ['$$raw','—'] } ] },
                  '0',
                  '$$raw'
                ]
              }
            }
          }
        }
      }
    } },
    { $group: { _id: { klasse: '$_canonKlasse', stufe: '$_canonStufe', geschlecht: '$Geschlecht', jahr: '$Besuchsjahr' }, count: { $sum: 1 } } }
  ];
  const rows = await col.aggregate(agg).toArray();

  // Build map: klasse -> { years: { [jahr]: { total, m, w, stufen: { stufe: { m,w,total } } } } }
  const map: Record<string, { years: Record<string, { total:number; m:number; w:number; stufen: Record<string, { m:number; w:number; total:number }> }> }> = {};
  for (const r of rows) {
    const klasse = normalizeKey(r._id.klasse);
  let stufe = normalizeKey(r._id.stufe);
  if (stufe === '—' || stufe === '-' || stufe.trim() === '') stufe = '0';
    const gesch = normalizeKey(r._id.geschlecht).toLowerCase();
    const jahr = normalizeKey(r._id.jahr);
    if (!map[klasse]) map[klasse] = { years: {} };
    if (!map[klasse].years[jahr]) map[klasse].years[jahr] = { total: 0, m: 0, w: 0, stufen: {} };
    const cnt = Number(r.count || 0);
    map[klasse].years[jahr].total += cnt;
    if (gesch.startsWith('w')) map[klasse].years[jahr].w += cnt;
    else if (gesch.startsWith('m')) map[klasse].years[jahr].m += cnt;
  if (!map[klasse].years[jahr].stufen[stufe]) map[klasse].years[jahr].stufen[stufe] = { m: 0, w: 0, total: 0 };
    map[klasse].years[jahr].stufen[stufe].total += cnt;
    if (gesch.startsWith('w')) map[klasse].years[jahr].stufen[stufe].w += cnt;
    else if (gesch.startsWith('m')) map[klasse].years[jahr].stufen[stufe].m += cnt;
  }

  // Ensure classes includes any found in map (and normalize keys)
  const allClasses = Array.from(new Set([
    ...classes.map(c=>normalizeKey(c)),
    ...Object.keys(map)
  ])).filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b)));

  // Build aggregated map per class (across years) for stufen totals
  const aggregatedMap: Record<string, { total:number; m:number; w:number; stufen: Record<string, { m:number; w:number; total:number }> }> = {};
  for (const cls of allClasses) {
    aggregatedMap[cls] = { total: 0, m: 0, w: 0, stufen: {} };
    const entry = map[cls] && map[cls].years ? map[cls].years : {};
    for (const y of Object.keys(entry)) {
      const yEntry = entry[y];
      if (!yEntry) continue;
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
  }

    // Ensure every aggregatedMap entry has explicit keys for all stufen (so client renders m/w cells)
    for (const cls of allClasses) {
      const am = aggregatedMap[cls] || (aggregatedMap[cls] = { total: 0, m: 0, w: 0, stufen: {} });
      for (const s of stufen) {
        if (!am.stufen[s]) am.stufen[s] = { m: 0, w: 0, total: 0 };
      }
    }

  // Normalize map shape for the client: map[klasse] -> years -> YearStats
  const clientMap: Record<string, Record<string, { total:number; w:number; m:number }>> = {};
  for (const k of Object.keys(map)) {
    clientMap[k] = {};
    for (const y of Object.keys(map[k].years || {})) {
      const ye = map[k].years[y];
      clientMap[k][y] = { total: ye.total || 0, w: ye.w || 0, m: ye.m || 0 };
    }
  }

  const data = { classes: allClasses, stufen, years: yearsAll, map: clientMap, aggregatedMap };
  return (
    <div className="w-full flex justify-center pt-10 px-6">
      <div className="w-full max-w-6xl">
        <BackLink />
        <h1 className="text-2xl font-bold mb-6">Statistik nach Klassen</h1>
        <StatistikClient data={data} />
      </div>
    </div>
  );
}
