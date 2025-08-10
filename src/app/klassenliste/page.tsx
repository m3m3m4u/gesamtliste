"use client";
import React, { useEffect, useState } from 'react';
import { exportExcel, exportPDF, exportWord } from '@/lib/exporters';

type Student = Record<string, any>;

interface Option { value: string; label: string; }

export default function KlassenListePage() {
  const [klasse, setKlasse] = useState('');
  const [availableKlassen, setAvailableKlassen] = useState<Option[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>(['Vorname','Familienname','Benutzername','Passwort']);
  const [data, setData] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Felder die auswählbar sind (kann erweitert werden)
  const FIELD_OPTIONS: string[] = [
    'Vorname','Familienname','Nachname','Benutzername','Geburtsdatum','Klasse 25/26','Status','Muttersprache','Religion','Passwort','Angebote','Frühbetreuung'
  ];

  // Klassen-Liste aus DB laden (einmal)
  useEffect(() => {
    (async () => {
      try {
        // Wir holen nur die Felder Klasse / Klasse 25/26 etc. begrenzt
  // Wir nutzen als maßgebliche Kategorie nur 'Klasse 25/26'
  const res = await fetch('/api/students?limit=2000&fields=Klasse 25/26');
        const json = await res.json();
        const setK = new Set<string>();
  for (const s of json.items || []) if (s['Klasse 25/26']) setK.add(String(s['Klasse 25/26']));
        const opts = Array.from(setK).sort().map(v => ({ value: v, label: v }));
        setAvailableKlassen(opts);
      } catch (e:any) {
        console.error(e);
      }
    })();
  }, []);

  async function load() {
    if (!klasse) { setData([]); return; }
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ klasse, limit: '2000', fields: selectedFields.join(',') });
      const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json.items || []);
    } catch (e:any) {
      setError(e.message || 'Fehler');
      setData([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [klasse, selectedFields.join(',')]);

  function toggleField(f: string) {
    setSelectedFields(prev => prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f]);
  }

  function fmtDate(v: any) {
    if (typeof v === 'string') {
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO
      if (m) return `${m[3]}.${m[2]}.${m[1]}`;
      const m2 = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); // already formatted
      if (m2) return v;
    }
    return v;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Klassenliste</h1>
        <a href="/" className="text-sm text-blue-600 underline">Startseite</a>
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
          <div className="flex gap-2">
            <button onClick={() => {
              const rows = data.map(d => selectedFields.map(f => {
                let val = d[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (Array.isArray(val)) return val.join(', ');
                return val ?? '';
              }));
              exportExcel({ filenameBase: `klasse-${klasse}`, headers: selectedFields, rows });
            }} className="px-3 py-1 rounded bg-emerald-600 text-white text-xs">Excel</button>
            <button onClick={() => {
              const rows = data.map(d => selectedFields.map(f => {
                let val = d[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (Array.isArray(val)) return val.join(', ');
                return val ?? '';
              }));
              exportPDF({ filenameBase: `klasse-${klasse}`, headers: selectedFields, rows });
            }} className="px-3 py-1 rounded bg-red-600 text-white text-xs">PDF</button>
            <button onClick={() => {
              const rows = data.map(d => selectedFields.map(f => {
                let val = d[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (Array.isArray(val)) return val.join(', ');
                return val ?? '';
              }));
              exportWord({ filenameBase: `klasse-${klasse}`, headers: selectedFields, rows });
            }} className="px-3 py-1 rounded bg-indigo-600 text-white text-xs">Word</button>
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
                  {selectedFields.map(f => <th key={f} className="text-left px-3 py-2 font-semibold">{f}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.map((row,i) => (
                  <tr key={row._id || i} className={i%2? 'bg-gray-50' : ''}>
                    {selectedFields.map(f => {
                      let v = row[f];
                      if (f === 'Geburtsdatum') v = fmtDate(v);
                      if (Array.isArray(v)) v = v.join(', ');
                      if (v === null || v === undefined) v = '';
                      return <td key={f} className="px-3 py-1 whitespace-pre-wrap break-words max-w-[220px]">{String(v)}</td>;
                    })}
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
