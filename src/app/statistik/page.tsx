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
  // Stufen werden später dynamisch aus den realen Dokumenten ermittelt
  let rawStufen: string[] = [];
  const rawYears = await col.distinct('Besuchsjahr', match) as string[];
  let stufen: string[] = [];
  const yearsNormalized = rawYears.map(y=>normalizeKey(y)).filter(Boolean);
  // Build all years list: prefer numeric sort if possible
  const numericYears = yearsNormalized.map(v => { const n = parseInt(v,10); return isNaN(n) ? null : n; }).filter(n=>n!=null) as number[];
  let yearsAll: string[] = [];
  if (numericYears.length) {
    yearsAll = Array.from(new Set(numericYears.sort((a,b)=>a-b).map(String)));
  } else {
    yearsAll = Array.from(new Set(yearsNormalized.sort()));
  }

  // Hole relevante Felder und zähle in JS (robuster bei leeren Strings / Varianten)
  const docs = await col.find(match, { projection: {
    'Klasse 25/26':1,'Klasse':1,'25/26':1,'Klasse25':1,'Klasse26':1,'Klasse 24/25':1,'Klasse 24/25_1':1,
    'Stufe 25/26':1,'Stufe 24/25':1,'Stufe 24/25_1':1,'Geschlecht':1,'Besuchsjahr':1
  } }).limit(20000).toArray();

  function clean(v: unknown): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s || s === '-' || s === '—') return null;
    return s;
  }
  function canonKlasse(d: any): string {
    const order = ['Klasse 25/26','Klasse','25/26','Klasse25','Klasse26','Klasse 24/25','Klasse 24/25_1'];
    for (const k of order) {
      const c = clean(d[k]);
      if (c) {
        // Normalisieren: Trim, Mehrfachspaces reduzieren, Großbuchstaben für Präfix
        const norm = c.replace(/\s+/g,'').toUpperCase();
        return norm;
      }
    }
    return '—';
  }
  function canonStufe(d: any): string {
    const vals: string[] = [];
    const order = ['Stufe 25/26','Stufe 24/25','Stufe 24/25_1'];
    for (const k of order) {
      const v = d[k];
      if (Array.isArray(v)) v.forEach(x=>{ const c=clean(x); if(c) vals.push(c); }); else { const c = clean(v); if (c) vals.push(c); }
    }
    if (!vals.length) return '0';
    const sorted = vals.sort();
    return sorted[0];
  }
  function canonGeschlecht(g: unknown): 'm'|'w'|'?' {
    if (Array.isArray(g)) {
      const counts: Record<string, number> = {};
      g.forEach(x=>{ const s=String(x??'').trim().toLowerCase(); if(s){ counts[s]=(counts[s]||0)+1; } });
      const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
      g = top;
    }
    const s = String(g ?? '').trim().toLowerCase();
    if (s === 'm' || s.startsWith('m')) return 'm';
    if (s === 'w' || s.startsWith('w')) return 'w';
    return '?';
  }
  const stufenSet = new Set<string>();

  const map: Record<string, { years: Record<string, { total:number; m:number; w:number; stufen: Record<string, { m:number; w:number; total:number }> }> }> = {};
  for (const d of docs) {
    const klasse = canonKlasse(d);
    const stufe = canonStufe(d);
    const jahr = clean(d.Besuchsjahr) || '—';
    const gesch = canonGeschlecht(d.Geschlecht);
    if (!map[klasse]) map[klasse] = { years: {} };
    if (!map[klasse].years[jahr]) map[klasse].years[jahr] = { total: 0, m: 0, w: 0, stufen: {} };
    const y = map[klasse].years[jahr];
    y.total += 1;
  if (gesch === 'm') y.m += 1; else if (gesch === 'w') y.w += 1; // '?' wird nur total gezählt
    if (!y.stufen[stufe]) y.stufen[stufe] = { m: 0, w: 0, total: 0 };
    const st = y.stufen[stufe];
    st.total += 1;
  if (gesch === 'm') st.m += 1; else if (gesch === 'w') st.w += 1;
    stufenSet.add(stufe);
  }

  // Stufenliste jetzt aus realen Daten ableiten und sortieren
  stufen = Array.from(stufenSet);
  const numericStufen = stufen.filter(s=>/^\d+$/.test(s)).map(Number).sort((a,b)=>a-b).map(String);
  const nonNumericStufen = stufen.filter(s=>!/^\d+$/.test(s)).sort((a,b)=>a.localeCompare(b,'de'));
  stufen = Array.from(new Set(['0', ...numericStufen.filter(s=>s!=='0'), ...nonNumericStufen]));
  ['8','9'].forEach(s=>{ if(!stufen.includes(s)) stufen.push(s); });

  // Ensure classes includes any found in map (and normalize keys)
  const allClasses = Array.from(new Set([
    ...classes.map(c=>normalizeKey(c).replace(/\s+/g,'').toUpperCase()),
    ...Object.keys(map)
  ])).filter(Boolean).sort((a,b)=>{
    // Muster: Buchstabe(n)+Zahl(en) -> zuerst Buchstaben, dann Zahl numerisch
    const r=/^([A-ZÄÖÜ]+)(\d*)$/i; const ma=a.match(r); const mb=b.match(r);
    if (ma && mb) {
      const la = ma[1].localeCompare(mb[1]);
      if (la!==0) return la;
      const na = ma[2]? parseInt(ma[2],10): -1; const nb = mb[2]? parseInt(mb[2],10): -1;
      return na-nb;
    }
    return a.localeCompare(b,'de');
  });

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
