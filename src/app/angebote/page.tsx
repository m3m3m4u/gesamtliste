"use client";
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { exportExcel, exportPDF, exportWord } from '@/lib/exporters';
import type { StudentDoc } from '@/lib/mongodb';
import { SchuljahresWechsler, useSchuljahr } from '@/lib/schuljahr';

type Row = StudentDoc & Record<string, unknown>;

export default function AngebotePage() {
  const { schuljahr } = useSchuljahr();

  // Jahresspezifische Feldnamen
  const angeboteFeld = `Angebote ${schuljahr}`;
  const fruehFeld = `Frühbetreuung ${schuljahr}`;
  const spFeld = `Schwerpunkte ${schuljahr}`;
  const sjKey = schuljahr.replace('/', ''); // '2526' oder '2627'

  const FIELD_OPTIONS = useMemo(() => [
    'Vorname','Familienname','Benutzername','Geburtsdatum',
    `Klasse ${schuljahr}`,`Stufe ${schuljahr}`,'Status','Muttersprache','Religion','Passwort',
    angeboteFeld,
    fruehFeld,
    spFeld,
  ], [schuljahr, angeboteFeld, fruehFeld, spFeld]);

  const [angebot, setAngebot] = useState('');
  const [stufe, setStufe] = useState('');
  const [angeboteList, setAngeboteList] = useState<string[]>([]);
  const [stufenList, setStufenList] = useState<string[]>([]);
  const [allowedSet, setAllowedSet] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<string[]>(['Vorname','Familienname','Benutzername']);
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Angebote-Liste aus jahresspezifischem Feld laden
  useEffect(() => {
    setAngebot(''); // Reset bei Schuljahreswechsel
    (async () => {
      try {
        const r = await fetch('/api/options', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const fieldKey = `angebote_${sjKey}` as keyof typeof j;
        const arr = Array.isArray(j[fieldKey]) ? j[fieldKey].map((s:string)=>String(s).trim()).filter(Boolean) : [];
        arr.sort((a:string,b:string)=>a.localeCompare(b,'de'));
        setAngeboteList(arr);
        setAllowedSet(new Set(arr.map((s:string)=>s.toLowerCase())));
      } catch {/* ignore */}
    })();
  }, [sjKey]);

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
  const toArr = useCallback((v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(x=>String(x).trim()).filter(Boolean);
    if (v == null) return [];
    const s = String(v).trim(); if (!s) return [];
    return s.split(/[,;/\n\r\t]+/).map(x=>x.trim()).filter(Boolean);
  }, []);
  const filterAllowedAngebote = useCallback((v: unknown): string => {
    const arr = toArr(v);
    if (!allowedSet.size) return arr.join(', ');
    return arr.filter(x=>allowedSet.has(x.toLowerCase())).join(', ');
  }, [allowedSet, toArr]);

  const load = useCallback(async () => {
    if (!angebot) { setData([]); return; }
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ angebot, limit: '3000', fields: selectedFields.join(','), schuljahr });
      if (stufe) params.set('stufe', stufe);
      const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const json: { items?: StudentDoc[] } = await res.json();
      setData(json.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler'); setData([]);
    } finally { setLoading(false); }
  }, [angebot, selectedFields, stufe, schuljahr]);
  const depsKey = useMemo(()=>selectedFields.join('|'),[selectedFields]);
  useEffect(() => { load(); }, [load, angebot, depsKey]);

  function normalizeSortVal(val: unknown, field: string): string {
    if (val == null) return '';
    if (Array.isArray(val)) return val.map(v=>String(v)).join(', ').toLowerCase();
    if (field === 'Geburtsdatum' && typeof val === 'string') {
      const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return iso[1]+iso[2]+iso[3];
      const de = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if (de) return de[3]+de[2]+de[1];
    }
    return String(val).toLowerCase();
  }

  const sortedData = useMemo(()=>{
    if (!sortField) return data;
    const copy = [...data];
    copy.sort((a,b)=>{
      let av: unknown; let bv: unknown;
      if (sortField === 'Familienname') {
        av = (a as Row)['Familienname'] ?? (a as Row)['Nachname'];
        bv = (b as Row)['Familienname'] ?? (b as Row)['Nachname'];
      } else if (sortField === angeboteFeld) {
        av = filterAllowedAngebote((a as Row)[angeboteFeld]);
        bv = filterAllowedAngebote((b as Row)[angeboteFeld]);
      } else {
        av = (a as Row)[sortField];
        bv = (b as Row)[sortField];
      }
      const AS = normalizeSortVal(av, sortField);
      const BS = normalizeSortVal(bv, sortField);
      if (AS < BS) return sortDir === 'asc' ? -1 : 1;
      if (AS > BS) return sortDir === 'asc' ? 1 : -1;
      const famA = normalizeSortVal((a as Row)['Familienname'] ?? (a as Row)['Nachname'], 'Familienname');
      const famB = normalizeSortVal((b as Row)['Familienname'] ?? (b as Row)['Nachname'], 'Familienname');
      if (famA !== famB) return famA.localeCompare(famB,'de');
      const vorA = normalizeSortVal((a as Row)['Vorname'], 'Vorname');
      const vorB = normalizeSortVal((b as Row)['Vorname'], 'Vorname');
      return vorA.localeCompare(vorB,'de');
    });
    return copy;
  }, [data, sortField, sortDir, filterAllowedAngebote, angeboteFeld]);

  function toggleSort(field: string) {
    if (sortField !== field) { setSortField(field); setSortDir('asc'); }
    else { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
  }

  function getCellValue(row: Row, f: string): string {
    let v = row[f];
    if (f === angeboteFeld && v == null) v = row['Angebote'];
    if (f === fruehFeld && v == null) v = row['Frühbetreuung'];
    if (f === spFeld && v == null) v = row['Schwerpunkte'] ?? row['Schwerpunkt'];
    if (f === 'Geburtsdatum') v = fmtDate(v);
    if (f === angeboteFeld) return filterAllowedAngebote(v);
    if (Array.isArray(v)) return v.join(', ');
    return v == null ? '' : String(v);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Angebotsliste</h1>
        <div className="flex items-center gap-4">
          <SchuljahresWechsler />
          <Link href="/" className="text-sm text-blue-600 underline">Zurück</Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1">Angebot wählen</label>
          <select value={angebot} onChange={e=>setAngebot(e.target.value)} className="border rounded px-3 py-2 min-w-[220px]">
            <option value="">– Angebot –</option>
            {angeboteList.map(a => <option key={a} value={a}>{a}</option>)}
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
        <div className="text-xs text-gray-500">{angebot && data.length ? `${data.length} Einträge` : ''}</div>
        {angebot && data.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => {
              const base = sortField ? sortedData : data;
              const rows = base.map(d => selectedFields.map(f => getCellValue(d as Row, f)));
              exportExcel({ filenameBase: `angebot-${angebot}`, headers: selectedFields, rows });
            }} className="px-3 py-1 rounded bg-emerald-600 text-white text-xs">Excel</button>
            <button onClick={async () => {
              const base = sortField ? sortedData : data;
              const rows = base.map(d => selectedFields.map(f => getCellValue(d as Row, f)));
              await exportPDF({ filenameBase: `angebot-${angebot}`, headers: selectedFields, rows });
            }} className="px-3 py-1 rounded bg-red-600 text-white text-xs">PDF</button>
            <button onClick={() => {
              const base = sortField ? sortedData : data;
              const rows = base.map(d => selectedFields.map(f => getCellValue(d as Row, f)));
              exportWord({ filenameBase: `angebot-${angebot}`, headers: selectedFields, rows, title: `Angebot: ${angebot}`, word: { zebra: true, orientation: 'landscape' } });
            }} className="px-3 py-1 rounded bg-indigo-600 text-white text-xs">Word</button>
          </div>
        )}
      </div>
      <div>
        {loading && <div className="text-sm">Lade…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && angebot && (
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
                {(sortField ? sortedData : data).map((row,i) => (
                  <tr key={row._id || i} className={i%2? 'bg-gray-50' : ''}>
                    {selectedFields.map(f => (
                      <td key={f} className="px-3 py-1 whitespace-pre-wrap break-words max-w-[220px]">
                        {getCellValue(row as Row, f)}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={selectedFields.length} className="px-3 py-4 text-center text-gray-500 text-xs">Keine Daten</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!angebot && <div className="text-sm text-gray-500">Bitte Angebot wählen.</div>}
      </div>
    </div>
  );
}
