"use client";
import React, { useEffect, useState } from 'react';
import { exportExcel, exportPDF, exportWord } from '@/lib/exporters';

type Student = Record<string, any>;

const FIELD_OPTIONS = ['Vorname','Familienname','Nachname','Benutzername','Geburtsdatum','Klasse 25/26','Status','Muttersprache','Religion','Passwort','Angebote','Frühbetreuung','Schwerpunkte'];

export default function AngebotePage() {
  const [angebot, setAngebot] = useState('');
  const [angeboteList, setAngeboteList] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>(['Vorname','Familienname','Benutzername']);
  const [data, setData] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/students?limit=3000&fields=Angebote');
        const json = await res.json();
        const setA = new Set<string>();
        for (const s of json.items || []) {
          if (Array.isArray(s.Angebote)) s.Angebote.forEach((a: any) => { if (a) setA.add(String(a)); });
        }
        setAngeboteList(Array.from(setA).sort());
      } catch (e) { /* ignore */ }
    })();
  }, []);

  function toggleField(f: string) {
    setSelectedFields(prev => prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f]);
  }

  function fmtDate(v: any) {
    if (typeof v === 'string') {
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[3]}.${m[2]}.${m[1]}`;
      const m2 = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if (m2) return v;
    }
    return v;
  }

  async function load() {
    if (!angebot) { setData([]); return; }
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ angebot, limit: '3000', fields: selectedFields.join(',') });
      const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json.items || []);
    } catch (e:any) {
      setError(e.message || 'Fehler'); setData([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [angebot, selectedFields.join(',')]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Angebotsliste</h1>
        <a href="/" className="text-sm text-blue-600 underline">Startseite</a>
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
              const rows = data.map(d => selectedFields.map(f => {
                let val = d[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (Array.isArray(val)) return val.join(', ');
                return val ?? '';
              }));
              exportExcel({ filenameBase: `angebot-${angebot}`, headers: selectedFields, rows });
            }} className="px-3 py-1 rounded bg-emerald-600 text-white text-xs">Excel</button>
            <button onClick={() => {
              const rows = data.map(d => selectedFields.map(f => {
                let val = d[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (Array.isArray(val)) return val.join(', ');
                return val ?? '';
              }));
              exportPDF({ filenameBase: `angebot-${angebot}`, headers: selectedFields, rows });
            }} className="px-3 py-1 rounded bg-red-600 text-white text-xs">PDF</button>
            <button onClick={() => {
              const rows = data.map(d => selectedFields.map(f => {
                let val = d[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (Array.isArray(val)) return val.join(', ');
                return val ?? '';
              }));
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
        {!angebot && <div className="text-sm text-gray-500">Bitte Angebot wählen.</div>}
      </div>
    </div>
  );
}
