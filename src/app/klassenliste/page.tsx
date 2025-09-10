"use client";
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { exportExcel, exportPDF, exportWord, exportAccountsPDF } from '@/lib/exporters';
import type { StudentDoc } from '@/lib/mongodb';

interface Option { value: string; label: string; }

export default function KlassenListePage() {
  const [klasse, setKlasse] = useState('');
  const [availableKlassen, setAvailableKlassen] = useState<Option[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>(['Vorname','Familienname','Stufe 25/26','Geschlecht','Benutzername','Passwort']);
  const [data, setData] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Felder die auswählbar sind (kann erweitert werden)
  const FIELD_OPTIONS: string[] = [
    'Vorname','Familienname','Stufe 25/26','Geschlecht','Benutzername','Geburtsdatum','Status','Muttersprache','Religion','Passwort','Angebote','Frühbetreuung'
  ];

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Klassen-Liste aus DB laden (einmal)
  useEffect(() => {
    (async () => {
      try {
        // Hole alle unterschiedlichen Werte aus Klasse 25/26 wie bei Listen (Filter)
        const res = await fetch('/api/students/distincts', { cache: 'no-store' });
        if(!res.ok) return;
        const json = await res.json();
        const arr = Array.isArray(json.klassen) ? json.klassen.map((v:string)=>v.trim()).filter((v:string)=>v.length>0) : [];
  const opts: Option[] = (arr as string[]).sort((a:string,b:string)=>a.localeCompare(b,'de')).map((v:string)=>({ value: v, label: v }));
        setAvailableKlassen(opts);
      } catch(e){ console.error(e); }
    })();
  }, []);
  const load = useCallback(async () => {
    if (!klasse) { setData([]); return; }
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ klasse, limit: '2000' });
      if (selectedFields.length) {
        // '25/26' immer mit abfragen, damit Filterung funktioniert
        const fields = [...selectedFields, '25/26'];
        params.set('fields', Array.from(new Set(fields)).join(','));
      }
      const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const json: { items?: StudentDoc[] } = await res.json();
  // Server liefert bereits nach Klasse gefilterte Ergebnisse -> kein zusätzliches clientseitiges Re-Filtering
  setData(json.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
      setData([]);
    } finally { setLoading(false); }
  }, [klasse, selectedFields]);
  const depsKey = useMemo(()=>selectedFields.join('|'),[selectedFields]);
  useEffect(() => { load(); }, [load, klasse, depsKey]);

  function toggleField(f: string) {
    setSelectedFields(prev => {
      const next = prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f];
      // Falls das aktuelle Sortierfeld entfernt wurde, Sortierung zurücksetzen
      if (sortField && !next.includes(sortField)) {
        setSortField(null);
      }
      return next;
    });
  }

  function normalizeSortVal(val: unknown, field: string): string {
    if (val == null) return '';
    if (Array.isArray(val)) return val.join(', ').toLowerCase();
    if (field === 'Geburtsdatum' && typeof val === 'string') {
      // Versuche ISO oder DD.MM.YYYY in YYYYMMDD umzuwandeln für korrekte Reihenfolge
      const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return iso[1] + iso[2] + iso[3];
      const de = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (de) return de[3] + de[2] + de[1];
    }
    return String(val).toLowerCase();
  }

  const sortedData = useMemo(() => {
    if (!sortField) return data;
    const copy = [...data];
    copy.sort((a,b)=>{
      const av = normalizeSortVal(a[sortField], sortField);
      const bv = normalizeSortVal(b[sortField], sortField);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      // Fallback zusätzliche stabile Kriterien (Familienname, Vorname)
      const famA = normalizeSortVal(a['Familienname'], 'Familienname');
      const famB = normalizeSortVal(b['Familienname'], 'Familienname');
      if (famA !== famB) return famA.localeCompare(famB, 'de');
      const vorA = normalizeSortVal(a['Vorname'], 'Vorname');
      const vorB = normalizeSortVal(b['Vorname'], 'Vorname');
      return vorA.localeCompare(vorB, 'de');
    });
    return copy;
  }, [data, sortField, sortDir]);

  function toggleSort(field: string) {
    if (sortField !== field) {
      setSortField(field); setSortDir('asc');
    } else {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    }
  }

  function fmtDate(v: unknown): string | unknown {
    if (typeof v === 'string') {
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO
      if (m) return `${m[3]}.${m[2]}.${m[1]}`;
      const m2 = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); // already formatted
      if (m2) return v;
    }
    return v;
  }

  function cellValue(d: StudentDoc, f: string): string {
  // Fallback für Familienname: falls nur 'Nachname' im Dokument vorhanden ist
  const rec = d as Record<string, unknown>; // generischer Zugriff ohne any
  let val: unknown = f === 'Familienname' ? (rec['Familienname'] ?? rec['Nachname']) : rec[f];
    if (f === 'Stufe 25/26') {
      // Wenn Stufe fehlt oder leer -> als '0' anzeigen
      if (val == null || String(val).trim() === '' || val === '-' || val === '—') return '0';
    }
    if (f === 'Geburtsdatum') val = fmtDate(val);
    if (Array.isArray(val)) return val.join(', ');
    if (val == null) return '';
    return String(val);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Klassenliste</h1>
  <Link href="/" className="text-sm text-blue-600 underline">Zurück</Link>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1">Klasse wählen</label>
          <select value={klasse} onChange={e=>setKlasse(e.target.value)} className="border rounded px-3 py-2 min-w-[180px]">
            <option value="">– Klasse –</option>
            {availableKlassen.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
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
        <div className="text-xs text-gray-500">{klasse && data.length ? `${data.length} Einträge` : ''}</div>
        {klasse && data.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => {
              const rows = sortedData.map(d => selectedFields.map(f => cellValue(d,f)));
              exportExcel({ filenameBase: `klasse-${klasse}`, headers: selectedFields, rows, title: `Klassenliste ${klasse}` });
            }} className="px-3 py-1 rounded bg-emerald-600 text-white text-xs">Excel</button>
            <button onClick={() => {
              const rows = sortedData.map(d => selectedFields.map(f => cellValue(d,f)));
              exportPDF({ filenameBase: `klasse-${klasse}`, headers: selectedFields, rows, title: `Klassenliste ${klasse}` });
            }} className="px-3 py-1 rounded bg-red-600 text-white text-xs">PDF</button>
            <button onClick={() => {
              const rows = sortedData.map(d => selectedFields.map(f => cellValue(d,f)));
              exportWord({ filenameBase: `klasse-${klasse}`, headers: selectedFields, rows, title: `Klassenliste ${klasse}`, word: { zebra: true } });
            }} className="px-3 py-1 rounded bg-indigo-600 text-white text-xs">Word</button>
            <button onClick={() => {
              // Account-Karten PDF ohne any-Casts
              const students = sortedData.map(d => {
                const rec = d as Record<string, unknown>;
                const fam = (rec['Familienname'] ?? rec['Nachname']);
                return {
                  Vorname: typeof d.Vorname === 'string' ? d.Vorname : undefined,
                  Familienname: typeof fam === 'string' ? fam : undefined,
                  Benutzername: typeof rec['Benutzername'] === 'string' ? String(rec['Benutzername']) : undefined,
                  Passwort: typeof rec['Passwort'] === 'string' ? String(rec['Passwort']) : undefined,
                  Anton: typeof rec['Anton'] === 'string' ? String(rec['Anton']) : undefined,
                };
              });
              exportAccountsPDF(students, { filenameBase: `accounts-${klasse}`, title: `Zugangsdaten ${klasse}`, columns: 3, unicodeFont: true });
            }} className="px-3 py-1 rounded bg-fuchsia-600 text-white text-xs" title="PDF Karten mit Zugangsdaten">Accounts PDF</button>
          </div>
        )}
      </div>
      <div>
        {loading && <div className="text-sm">Lade…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && klasse && (
          <div className="overflow-x-auto border rounded bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {selectedFields.map(f => {
                    const active = sortField === f;
                    const arrow = active ? (sortDir === 'asc' ? '▲' : '▼') : '';
                    return (
                      <th
                        key={f}
                        className="text-left px-3 py-2 font-semibold select-none cursor-pointer hover:bg-gray-200 transition"
                        onClick={()=>toggleSort(f)}
                        title={active ? `Sortierung: ${sortDir === 'asc' ? 'aufsteigend' : 'absteigend'} (klicken zum Umschalten)` : 'Klicken zum Sortieren'}
                      >
                        <span className="inline-flex items-center gap-1">
                          <span>{f}</span>
                          {arrow && <span className="text-[10px] opacity-70">{arrow}</span>}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row,i) => (
                  <tr key={row._id || i} className={i%2? 'bg-gray-50' : ''}>
                    {selectedFields.map(f => (
                      <td key={f} className="px-3 py-1 whitespace-pre-wrap break-words max-w-[220px]">{cellValue(row,f)}</td>
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
        {!klasse && <div className="text-sm text-gray-500">Bitte Klasse wählen.</div>}
      </div>
    </div>
  );
}
