"use client";
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { exportExcel, exportPDF, exportWord } from '@/lib/exporters';
import type { StudentDoc } from '@/lib/mongodb';
import { SchuljahresWechsler } from '@/lib/schuljahr';
type Student = StudentDoc;
type Row = Student & { [key: string]: unknown };

type OptionenResponse = {
  angebote?: unknown[];
  schwerpunkte?: unknown[];
};

const FIELD_OPTIONS = ['Vorname','Familienname','Benutzername','Geburtsdatum','Klasse 25/26','Stufe 25/26','Status','Muttersprache','Religion','Passwort','Angebote','Frühbetreuung','Schwerpunkte'];

function normalizeOptionList(values: unknown[]): string[] {
  const map = new Map<string, string>();
  for (const raw of values) {
    const cleaned = String(raw ?? '').trim().replace(/\s{2,}/g, ' ');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!map.has(key)) map.set(key, cleaned);
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
}

function splitSchwerpunkteString(str: string): string[] {
  const norm = str.replace(/\r?\n+/g, ';');
  return norm
    .split(/[;,+&|\\/\t]/)
    .flatMap(part => part.split(/\s{2,}/))
    .map(s => s.trim())
    .filter(Boolean);
}

export default function SchwerpunktePage() {
  const [schwerpunkt, setSchwerpunkt] = useState('');
  const [stufe, setStufe] = useState('');
  const [liste, setListe] = useState<string[]>([]);
  const [stufenList, setStufenList] = useState<string[]>([]);
  const [allowedAngebote, setAllowedAngebote] = useState<Set<string>>(new Set());
  const [allowedSchwerpunkteSet, setAllowedSchwerpunkteSet] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<string[]>(['Vorname','Familienname','Benutzername']);
  const [data, setData] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  useEffect(() => {
    (async () => {
      try {
        const [optRes, studentsRes] = await Promise.all([
          fetch('/api/options', { cache: 'no-store' }),
          fetch('/api/students?limit=3000&fields=Schwerpunkte,Schwerpunkt')
        ]);

        const optJson: OptionenResponse | null = optRes.ok ? await optRes.json() : null;
        const studentJson: { items?: Student[] } = studentsRes.ok ? await studentsRes.json() : { items: [] };

        const angebotSet = new Set<string>();
        optJson?.angebote?.forEach((s) => {
          const value = String(s ?? '').trim();
          if (value) angebotSet.add(value.toLowerCase());
        });
        setAllowedAngebote(angebotSet);

        let schwerpunkteList: string[] = [];
        if (optJson?.schwerpunkte && optJson.schwerpunkte.length) {
          schwerpunkteList = normalizeOptionList(optJson.schwerpunkte);
        } else {
          const tokens: string[] = [];
          for (const s of (studentJson.items || []) as Student[]) {
            if (Array.isArray(s.Schwerpunkte)) {
              tokens.push(...s.Schwerpunkte.map(v => String(v ?? '').trim()).filter(Boolean));
            } else if (typeof s.Schwerpunkte === 'string') {
              tokens.push(...splitSchwerpunkteString(s.Schwerpunkte));
            }
            if (Array.isArray(s.Schwerpunkt)) {
              tokens.push(...s.Schwerpunkt.map(v => String(v ?? '').trim()).filter(Boolean));
            } else if (typeof s.Schwerpunkt === 'string') {
              tokens.push(...splitSchwerpunkteString(s.Schwerpunkt));
            }
          }
          schwerpunkteList = normalizeOptionList(tokens)
            .filter(v => !/^schwerpunkt\s*\d+$/i.test(v) && !/^schwerpunkt$/i.test(v));
        }

        setListe(schwerpunkteList);
        setAllowedSchwerpunkteSet(new Set(schwerpunkteList.map(v => v.toLowerCase())));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (schwerpunkt && !liste.includes(schwerpunkt)) {
      setSchwerpunkt('');
    }
  }, [liste, schwerpunkt]);

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
  const extractSchwerpunkteTokens = useCallback((row: Student): string[] => {
    const tokens: string[] = [];
    const addFrom = (val: unknown) => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach(addFrom);
        return;
      }
      const str = String(val ?? '');
      if (!str) return;
      tokens.push(...splitSchwerpunkteString(str));
    };
    const r = row as Row;
    addFrom(r.Schwerpunkte);
    addFrom(r.Schwerpunkt);
    const map = new Map<string, string>();
    tokens.forEach(tok => {
      const cleaned = tok.trim().replace(/\s{2,}/g, ' ');
      if (!cleaned) return;
      const key = cleaned.toLowerCase();
      if (!map.has(key)) map.set(key, cleaned);
    });
    let values = Array.from(map.values()).filter(v => !/^schwerpunkt\s*\d+$/i.test(v) && !/^schwerpunkt$/i.test(v));
    if (allowedSchwerpunkteSet.size) {
      values = values.filter(v => allowedSchwerpunkteSet.has(v.toLowerCase()));
    }
    return values;
  }, [allowedSchwerpunkteSet]);

  const hasAnySchwerpunkt = useCallback((s: Student) => extractSchwerpunkteTokens(s).length > 0, [extractSchwerpunkteTokens]);

  const combinedSchwerpunkte = useCallback((row: Student): string => extractSchwerpunkteTokens(row).join(', '), [extractSchwerpunkteTokens]);

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
  }, [schwerpunkt, selectedFields, stufe, hasAnySchwerpunkt]);
  const depsKey = useMemo(()=>selectedFields.join('|'),[selectedFields]);
  useEffect(() => { load(); }, [load, depsKey]);

  function normalizeSortVal(val: unknown, field: string): string {
    if (val == null) return '';
    if (Array.isArray(val)) return val.map(v=>String(v)).join(', ').toLowerCase();
    if (field === 'Geburtsdatum' && typeof val === 'string') {
      const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return iso[1]+iso[2]+iso[3];
      const de = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if (de) return de[3]+de[2]+de[1];
    }
    return String(val).toLowerCase();
  }
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
        <div className="flex items-center gap-4">
          <SchuljahresWechsler />
          <Link href="/" className="text-sm text-blue-600 underline">Zurück</Link>
        </div>
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
                if (f === 'Schwerpunkte') return combinedSchwerpunkte(d as Student);
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
                if (f === 'Schwerpunkte') return combinedSchwerpunkte(d as Student);
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
                if (f === 'Schwerpunkte') return combinedSchwerpunkte(d as Student);
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
                      else if (f === 'Schwerpunkte') v = combinedSchwerpunkte(row as Student);
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
