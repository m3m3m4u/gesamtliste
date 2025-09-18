"use client";
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { exportExcel, exportPDF, exportWord } from '@/lib/exporters';
import type { StudentDoc } from '@/lib/mongodb';
type Student = StudentDoc;
type Row = Student & { [key: string]: unknown };

const FIELD_OPTIONS = ['Vorname','Familienname','Benutzername','Geburtsdatum','Klasse 25/26','Stufe 25/26','Status','Muttersprache','Religion','Passwort','Angebote','Frühbetreuung','Schwerpunkte'];

export default function SchwerpunktePage() {
  const [schwerpunkt, setSchwerpunkt] = useState('');
  const [stufe, setStufe] = useState('');
  const [liste, setListe] = useState<string[]>([]);
  const [stufenList, setStufenList] = useState<string[]>([]);
  const [allowedAngebote, setAllowedAngebote] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<string[]>(['Vorname','Familienname','Benutzername']);
  const [data, setData] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  useEffect(() => {
    (async () => {
      try {
  const res = await fetch('/api/students?limit=3000&fields=Schwerpunkte,Schwerpunkt');
        const json = await res.json();
        // Lade aktuelle Angebote-Liste separat für erlaubte Filterung
        try {
          const optRes = await fetch('/api/options',{cache:'no-store'});
          if (optRes.ok){
            const optJson = await optRes.json();
            if (Array.isArray(optJson.angebote)) {
              const set = new Set<string>();
              optJson.angebote.forEach((s:string)=>{ const t = String(s).trim(); if(t) set.add(t.toLowerCase()); });
              setAllowedAngebote(set);
            }
          }
        } catch {/* ignore options load */}
        const uniqueMap = new Map<string,string>(); // lower -> original
        const pushToken = (raw: string) => {
          const cleaned = raw.trim().replace(/\s{2,}/g,' ');
          if (!cleaned) return;
            const key = cleaned.toLowerCase();
            if (!uniqueMap.has(key)) uniqueMap.set(key, cleaned);
        };
        const splitString = (str: string) => {
          // Ersetze Zeilenumbrüche durch Semikolon als Trenner
          const norm = str.replace(/\r?\n+/g,';');
          // Split an ; , / \\ | + & und Kombinationen sowie Tab
          return norm.split(/[;,+&|\\\/\t]/).flatMap(part => part.split(/\s{2,}/)).map(s=>s.trim()).filter(Boolean);
        };
  for (const s of (json.items || []) as Student[]) {
          let tokens: string[] = [];
          if (Array.isArray(s.Schwerpunkte)) tokens = tokens.concat(s.Schwerpunkte.map(String));
          else if (typeof s.Schwerpunkte === 'string') tokens = tokens.concat(splitString(s.Schwerpunkte));
          if (Array.isArray(s.Schwerpunkt)) tokens = tokens.concat(s.Schwerpunkt.map(String));
          else if (typeof s.Schwerpunkt === 'string') tokens = tokens.concat(splitString(s.Schwerpunkt));
          // 'Schwerpunkt 1' removed — older imports may still have data but we ignore this field now
          tokens.forEach(pushToken);
        }
        const list = Array.from(uniqueMap.values())
          .filter(v => !/^schwerpunkt\s*\d+$/i.test(v) && !/^schwerpunkt$/i.test(v))
          .sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));
        setListe(list);
  } catch { /* ignore */ }
    })();
  }, []);

  // Stufen laden
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/students/distincts', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const a: string[] = Array.isArray(j.stufen) ? j.stufen : [];
        setStufenList(a);
      } catch {/* ignore */}
    })();
  }, []);

  function toggleField(f: string) {
    setSelectedFields(prev => prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f]);
  }

  function fmtDate(v: unknown): string | unknown {
    if (typeof v === 'string') {
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[3]}.${m[2]}.${m[1]}`;
      const m2 = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if (m2) return v;
    }
    return v;
  }
  function hasAnySchwerpunkt(s: Student): boolean {
    const sources: string[] = [];
    if (Array.isArray(s.Schwerpunkte)) sources.push(...s.Schwerpunkte.map(String));
    if (Array.isArray(s.Schwerpunkt)) sources.push(...s.Schwerpunkt.map(String));
  ['Schwerpunkte','Schwerpunkt'].forEach(k => {
      const raw = s[k];
      if (typeof raw === 'string') sources.push(...raw.split(/\r?\n|[;,+&|\\\/]/));
    });
    return sources.some(x => x.trim().length > 0);
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
  const baseFields = new Set<string>([...selectedFields,'Schwerpunkte','Schwerpunkt']);
      const params = new URLSearchParams({ limit: '3000', fields: Array.from(baseFields).join(',') });
      if (schwerpunkt) params.set('schwerpunkt', schwerpunkt);
      if (stufe) params.set('stufe', stufe);
      const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const json: { items?: Student[] } = await res.json();
      let items: Student[] = json.items || [];
      if (!schwerpunkt) items = items.filter(hasAnySchwerpunkt);
      setData(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler'); setData([]);
    } finally { setLoading(false); }
  }, [schwerpunkt, selectedFields, stufe]);
  const depsKey = useMemo(()=>selectedFields.join('|'),[selectedFields]);
  useEffect(() => { load(); }, [load, schwerpunkt, depsKey]);

  function normalizeSortVal(val: unknown, field: string): string {
    if (val == null) return '';
    if (Array.isArray(val)) return val.map(v=>String(v)).join(', ').toLowerCase();
    if (field === 'Geburtsdatum' && typeof val === 'string') {
      const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return iso[1]+iso[2]+iso[3];
      const de = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if (de) return de[3]+de[2]+de[1];
    }
    return String(val).toLowerCase();
  }
  const combinedSchwerpunkte = useCallback((row: Student): string => {
    const parts: string[] = [];
    const add = (x: unknown) => { if (!x) return; if (Array.isArray(x)) x.forEach(add); else if (typeof x === 'string') parts.push(...x.split(/[;,+&|\n\r\t\\\/]/).map(s=>s.trim()).filter(Boolean)); };
    const r = row as Row;
    add(r.Schwerpunkte);
    add(r.Schwerpunkt);
    const uniq = Array.from(new Set(parts.map(p=>p.toLowerCase()))).map(lc => parts.find(p=>p.toLowerCase()===lc) || lc);
    return uniq.join(', ');
  }, []);
  const filterAllowedAngebote = useCallback((val: unknown): string => {
    if (!allowedAngebote.size) {
      if (Array.isArray(val)) return val.map(v=>String(v)).filter(Boolean).join(', ');
      if (typeof val === 'string') return val;
      return '';
    }
    const parts: string[] = [];
    if (Array.isArray(val)) parts.push(...val.map(v=>String(v)));
    else if (typeof val === 'string') parts.push(...val.split(/[,;/\n\r\t]+/));
    return parts.map(p=>p.trim()).filter(p=>p && allowedAngebote.has(p.toLowerCase())).join(', ');
  }, [allowedAngebote]);
  const sortedData = useMemo(()=>{
    if (!sortField) return data;
    const copy = [...data];
    copy.sort((a,b)=>{
      const A = a as Row; const B = b as Row;
      let av: unknown; let bv: unknown;
      if (sortField === 'Familienname') {
        av = A['Familienname'] ?? A['Nachname'];
        bv = B['Familienname'] ?? B['Nachname'];
      } else if (sortField === 'Schwerpunkte') {
        av = combinedSchwerpunkte(A);
        bv = combinedSchwerpunkte(B);
      } else if (sortField === 'Angebote') {
        av = filterAllowedAngebote(A['Angebote']);
        bv = filterAllowedAngebote(B['Angebote']);
      } else {
        av = A[sortField];
        bv = B[sortField];
      }
      const AS = normalizeSortVal(av, sortField);
      const BS = normalizeSortVal(bv, sortField);
      if (AS < BS) return sortDir === 'asc' ? -1 : 1;
      if (AS > BS) return sortDir === 'asc' ? 1 : -1;
      const famA = normalizeSortVal(A['Familienname'] ?? A['Nachname'], 'Familienname');
      const famB = normalizeSortVal(B['Familienname'] ?? B['Nachname'], 'Familienname');
      if (famA !== famB) return famA.localeCompare(famB,'de');
      const vorA = normalizeSortVal(A['Vorname'], 'Vorname');
      const vorB = normalizeSortVal(B['Vorname'], 'Vorname');
      return vorA.localeCompare(vorB,'de');
    });
    return copy;
  }, [data, sortField, sortDir, combinedSchwerpunkte, filterAllowedAngebote]);
  function toggleSort(field: string) {
    if (sortField !== field) { setSortField(field); setSortDir('asc'); }
    else { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schwerpunkte</h1>
  <Link href="/" className="text-sm text-blue-600 underline">Zurück</Link>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1">Schwerpunkt wählen</label>
          <select value={schwerpunkt} onChange={e=>setSchwerpunkt(e.target.value)} className="border rounded px-3 py-2 min-w-[220px]">
            <option value="">– Schwerpunkt –</option>
            {liste.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Stufe</label>
          <select value={stufe} onChange={e=>setStufe(e.target.value)} className="border rounded px-3 py-2 min-w-[120px]">
            <option value="">Alle</option>
            {stufenList.map(s => (
              <option key={s} value={s}>{s === '0' ? '0 (leer)' : s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Felder</label>
          <div className="flex flex-wrap gap-2 max-w-xl">
            {FIELD_OPTIONS.map(f => (
              <label key={f} className="flex items-center gap-1 text-xs border rounded px-2 py-1 bg-white">
                <input type="checkbox" checked={selectedFields.includes(f)} onChange={()=>toggleField(f)} />
                {f}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 items-center">
  <div className="text-xs text-gray-500">{data.length ? `${data.length} Einträge` : ''}</div>
  {data.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => {
              const base = sortField ? sortedData : data;
              const rows = base.map(d => { const row = d as Row; return selectedFields.map(f => {
                let val: unknown = row[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (f === 'Angebote') return filterAllowedAngebote(val);
                if (Array.isArray(val)) return val.join(', ');
                return val == null ? '' : String(val);
              }); });
              exportExcel({ filenameBase: `schwerpunkt-${schwerpunkt}`, headers: selectedFields, rows });
            }} className="px-3 py-1 rounded bg-emerald-600 text-white text-xs">Excel</button>
            <button onClick={async () => {
              const base = sortField ? sortedData : data;
              const rows = base.map(d => { const row = d as Row; return selectedFields.map(f => {
                let val: unknown = row[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (f === 'Angebote') return filterAllowedAngebote(val);
                if (Array.isArray(val)) return val.join(', ');
                return val == null ? '' : String(val);
              }); });
              await exportPDF({ filenameBase: `schwerpunkt-${schwerpunkt}`, headers: selectedFields, rows });
            }} className="px-3 py-1 rounded bg-red-600 text-white text-xs">PDF</button>
            <button onClick={() => {
              const base = sortField ? sortedData : data;
              const rows = base.map(d => { const row = d as Row; return selectedFields.map(f => {
                let val: unknown = row[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (f === 'Angebote') return filterAllowedAngebote(val);
        if (Array.isArray(val)) val = val.join(', ');
                return val == null ? '' : String(val);
              }); });
              exportWord({ filenameBase: `schwerpunkt-${schwerpunkt}`, headers: selectedFields, rows, title: `Schwerpunkt: ${schwerpunkt}`, word: { zebra: true, orientation: 'landscape' } });
            }} className="px-3 py-1 rounded bg-indigo-600 text-white text-xs">Word</button>
          </div>
        )}
      </div>
      <div>
        {loading && <div className="text-sm">Lade…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
  {!loading && !error && data.length > 0 && (
          <div className="overflow-x-auto border rounded bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                    {selectedFields.map(f => {
                    const active = sortField === f;
                    return (
                      <th
                        key={f}
                        onClick={()=>toggleSort(f)}
                        className={"text-left px-3 py-2 font-semibold select-none "+(active? 'bg-blue-50 cursor-pointer':'cursor-pointer hover:bg-gray-200 transition')}
                        title={active? `Sortierung: ${sortDir==='asc'?'auf':'ab'}steigend (klicken zum Umschalten)` : 'Klicken zum Sortieren'}
                      >
                        <span className="inline-flex items-center gap-1">
                          <span>{f}</span>
                          {active && <span className="text-[10px] opacity-70">{sortDir==='asc'? '▲':'▼'}</span>}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(sortField ? sortedData : data).map((row,i) => { const r = row as Row; return (
                  <tr key={r._id || i} className={i%2? 'bg-gray-50' : ''}>
                    {selectedFields.map(f => {
                      let v: unknown = r[f];
                      if (f === 'Geburtsdatum') v = fmtDate(v);
                      if (f === 'Angebote') v = filterAllowedAngebote(v);
                      else if (Array.isArray(v)) v = v.join(', ');
                      if (v === null || v === undefined) v = '';
                      return <td key={f} className="px-3 py-1 whitespace-pre-wrap break-words max-w-[220px]">{String(v)}</td>;
                    })}
                  </tr>
                ); })}
                {data.length === 0 && (
                  <tr><td colSpan={selectedFields.length} className="px-3 py-4 text-center text-gray-500 text-xs">Keine Daten</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
  {!schwerpunkt && !loading && !error && data.length === 0 && <div className="text-sm text-gray-500">Keine Schüler mit Schwerpunkt gefunden.</div>}
      </div>
    </div>
  );
}
