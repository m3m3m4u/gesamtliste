"use client";
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { exportExcel, exportPDF, exportWord } from '@/lib/exporters';
import type { StudentDoc } from '@/lib/mongodb';

// Felder analog zu Angebote/Schwerpunkte-Seiten
const FIELD_OPTIONS = ['Vorname','Familienname','Benutzername','Geburtsdatum','Klasse 25/26','Status','Muttersprache','Religion','Passwort','Angebote','Frühbetreuung','Schwerpunkte'];

// Row Typ für dynamische Feldzugriffe (Index-Signature nur für erlaubte Felder)
type Row = StudentDoc & { [key: string]: unknown };

export default function FruehbetreuungPage() {
  const [slot, setSlot] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [allowedSet, setAllowedSet] = useState<Set<string>>(new Set());
  const [allowedAngebote, setAllowedAngebote] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<string[]>(['Vorname','Familienname','Benutzername']);
  const [data, setData] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  useEffect(() => { (async () => { try { const r = await fetch('/api/options',{cache:'no-store'}); if(!r.ok) return; const j = await r.json(); const arr: string[] = Array.isArray(j.fruehbetreuung)? j.fruehbetreuung.map((s:string)=>String(s).trim()).filter(Boolean): []; // sortierung wie in optionen-Seite (Wochentage zuerst)
    const weekdayOrder = ['mo','montag','di','dienstag','mi','mittwoch','do','donnerstag','fr','freitag','sa','samstag','so','sonntag'];
    const score = (s: string) => { const lc = s.toLowerCase(); for (let i=0;i<weekdayOrder.length;i++){ if(lc.startsWith(weekdayOrder[i])) return i; } return 100 + s.localeCompare(s,'de'); };
    arr.sort((a,b)=>{ const sa=score(a); const sb=score(b); if (sa!==sb) return sa-sb; return a.localeCompare(b,'de'); });
    setSlots(arr); setAllowedSet(new Set(arr.map(v=>v.toLowerCase())));
    if (Array.isArray(j.angebote)) {
      const set = new Set<string>();
      j.angebote.forEach((s:string)=>{ const t=String(s).trim(); if(t) set.add(t.toLowerCase()); });
      setAllowedAngebote(set);
    }
  } catch{} })(); }, []);

  function toggleField(f: string){ setSelectedFields(p=>p.includes(f)? p.filter(x=>x!==f): [...p,f]); }

  function fmtDate(v: unknown): string | unknown { if (typeof v === 'string'){ const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return `${m[3]}.${m[2]}.${m[1]}`; const m2 = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if(m2) return v; } return v; }
  const toArr = useCallback((v: unknown): string[] => { if (Array.isArray(v)) return v.map(x=>String(x).trim()).filter(Boolean); if (v==null) return []; const s = String(v).trim(); if(!s) return []; return s.split(/[,;/\n\r\t]+/).map(x=>x.trim()).filter(Boolean); }, []);
  const filterAllowedSlot = useCallback((v: unknown): string => { const arr = toArr(v); if(!allowedSet.size) return arr.join(', '); return arr.filter(x=>allowedSet.has(x.toLowerCase())).join(', '); }, [allowedSet, toArr]);
  const filterAllowedAngebote = useCallback((v: unknown): string => { const arr = toArr(v); if(!allowedAngebote.size) return arr.join(', '); return arr.filter(x=>allowedAngebote.has(x.toLowerCase())).join(', '); }, [allowedAngebote, toArr]);

  const load = useCallback(async () => { if(!slot){ setData([]); return; } setLoading(true); setError(null); try { const params = new URLSearchParams({ fruehbetreuung: slot, limit: '3000', fields: selectedFields.join(',') }); const res = await fetch('/api/students?'+params.toString(), {cache:'no-store'}); if(!res.ok) throw new Error(await res.text()); const json: {items?: StudentDoc[]} = await res.json(); setData(json.items||[]); } catch(e){ setError(e instanceof Error ? e.message : 'Fehler'); setData([]);} finally{ setLoading(false);} }, [slot, selectedFields]);
  const depsKey = useMemo(()=>selectedFields.join('|'),[selectedFields]);
  useEffect(()=>{ load(); }, [load, slot, depsKey]);

  function normalizeSortVal(val: unknown, field: string): string { if (val==null) return ''; if (Array.isArray(val)) return val.map(v=>String(v)).join(', ').toLowerCase(); if (field==='Geburtsdatum' && typeof val === 'string'){ const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/); if(iso) return iso[1]+iso[2]+iso[3]; const de = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if(de) return de[3]+de[2]+de[1]; } return String(val).toLowerCase(); }

  const sortedData = useMemo(()=>{ if(!sortField) return data; const copy=[...data]; copy.sort((a,b)=>{ const A = a as Row; const B = b as Row; let av: unknown; let bv: unknown; if (sortField==='Familienname'){ av = A['Familienname'] ?? A['Nachname']; bv = B['Familienname'] ?? B['Nachname']; } else if (sortField==='Frühbetreuung'){ av = filterAllowedSlot(A['Frühbetreuung']); bv = filterAllowedSlot(B['Frühbetreuung']); } else if (sortField==='Angebote'){ av = filterAllowedAngebote(A['Angebote']); bv = filterAllowedAngebote(B['Angebote']); } else { av = A[sortField]; bv = B[sortField]; } const AS = normalizeSortVal(av, sortField); const BS = normalizeSortVal(bv, sortField); if (AS<BS) return sortDir==='asc'? -1:1; if (AS>BS) return sortDir==='asc'? 1:-1; const famA = normalizeSortVal(A['Familienname'] ?? A['Nachname'],'Familienname'); const famB = normalizeSortVal(B['Familienname'] ?? B['Nachname'],'Familienname'); if (famA!==famB) return famA.localeCompare(famB,'de'); const vorA = normalizeSortVal(A['Vorname'],'Vorname'); const vorB = normalizeSortVal(B['Vorname'],'Vorname'); return vorA.localeCompare(vorB,'de'); }); return copy; }, [data, sortField, sortDir, filterAllowedSlot, filterAllowedAngebote]);
  function toggleSort(field: string){ if (sortField !== field){ setSortField(field); setSortDir('asc'); } else { setSortDir(d=> d==='asc' ? 'desc' : 'asc'); } }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Frühbetreuung</h1>
        <Link href="/" className="text-sm text-blue-600 underline">Zurück</Link>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1">Frühbetreuung wählen</label>
          <select value={slot} onChange={e=>setSlot(e.target.value)} className="border rounded px-3 py-2 min-w-[220px]">
            <option value="">– Frühbetreuung –</option>
            {slots.map(a=> <option key={a} value={a}>{a}</option>)}
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
        <div className="text-xs text-gray-500">{slot && (sortField? sortedData : data).length ? `${(sortField? sortedData : data).length} Einträge` : ''}</div>
        {slot && data.length>0 && (
          <div className="flex gap-2">
            <button onClick={()=>{ const base = sortField? sortedData : data; const rows = base.map(d=>{ const row = d as Row; return selectedFields.map(f=>{ let val: unknown = row[f]; if (f==='Geburtsdatum') val = fmtDate(val); if (f==='Frühbetreuung') return filterAllowedSlot(val); if (f==='Angebote') return filterAllowedAngebote(val); if (Array.isArray(val)) return val.join(', '); return val==null? '' : String(val); }); }); exportExcel({ filenameBase: `fruehbetreuung-${slot}`, headers: selectedFields, rows }); }} className="px-3 py-1 rounded bg-emerald-600 text-white text-xs">Excel</button>
            <button onClick={async ()=>{ const base = sortField? sortedData : data; const rows = base.map(d=>{ const row = d as Row; return selectedFields.map(f=>{ let val: unknown = row[f]; if (f==='Geburtsdatum') val = fmtDate(val); if (f==='Frühbetreuung') return filterAllowedSlot(val); if (f==='Angebote') return filterAllowedAngebote(val); if (Array.isArray(val)) return val.join(', '); return val==null? '' : String(val); }); }); await exportPDF({ filenameBase: `fruehbetreuung-${slot}`, headers: selectedFields, rows }); }} className="px-3 py-1 rounded bg-red-600 text-white text-xs">PDF</button>
            <button onClick={()=>{ const base = sortField? sortedData : data; const rows = base.map(d=>{ const row = d as Row; return selectedFields.map(f=>{ let val: unknown = row[f]; if (f==='Geburtsdatum') val = fmtDate(val); if (f==='Frühbetreuung') return filterAllowedSlot(val); if (f==='Angebote') return filterAllowedAngebote(val); if (Array.isArray(val)) val = val.join(', '); return val==null? '' : String(val); }); }); exportWord({ filenameBase: `fruehbetreuung-${slot}`, headers: selectedFields, rows, title: `Frühbetreuung: ${slot}`, word: { zebra:true, orientation:'landscape' } }); }} className="px-3 py-1 rounded bg-indigo-600 text-white text-xs">Word</button>
          </div>
        )}
      </div>
      <div>
        {loading && <div className="text-sm">Lade…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && slot && (
          <div className="overflow-x-auto border rounded bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {selectedFields.map(f=>{ const active = sortField===f; return (
                    <th key={f} onClick={()=>toggleSort(f)} className={"text-left px-3 py-2 font-semibold select-none "+(active? 'bg-blue-50 cursor-pointer':'cursor-pointer hover:bg-gray-200 transition')} title={active? `Sortierung: ${sortDir==='asc'?'auf':'ab'}steigend (klicken zum Umschalten)`:'Klicken zum Sortieren'}>
                      <span className="inline-flex items-center gap-1">
                        <span>{f}</span>
                        {active && <span className="text-[10px] opacity-70">{sortDir==='asc'? '▲':'▼'}</span>}
                      </span>
                    </th> );})}
                </tr>
              </thead>
              <tbody>
                {(sortField? sortedData : data).map((row,i)=>{ const r = row as Row; return (
                  <tr key={r._id || i} className={i%2? 'bg-gray-50':''}>
                    {selectedFields.map(f=>{ let v: unknown = r[f]; if (f==='Geburtsdatum') v = fmtDate(v); if (f==='Frühbetreuung') v = filterAllowedSlot(v); else if (f==='Angebote') v = filterAllowedAngebote(v); else if (Array.isArray(v)) v = v.join(', '); if (v==null) v=''; return <td key={f} className="px-3 py-1 whitespace-pre-wrap break-words max-w-[220px]">{String(v)}</td>; })}
                  </tr>
                );})}
                {(sortField? sortedData : data).length===0 && (
                  <tr><td colSpan={selectedFields.length} className="px-3 py-4 text-center text-gray-500 text-xs">Keine Daten</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!slot && <div className="text-sm text-gray-500">Bitte Frühbetreuung wählen.</div>}
      </div>
    </div>
  );
}
