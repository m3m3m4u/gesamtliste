"use client";
import React, { useEffect, useState } from 'react';
import { exportExcel, exportPDF, exportWord } from '@/lib/exporters';

type Student = Record<string, any>;

const FIELD_OPTIONS = ['Vorname','Familienname','Nachname','Benutzername','Geburtsdatum','Klasse 25/26','Status','Muttersprache','Religion','Passwort','Angebote','Frühbetreuung','Schwerpunkte','Schwerpunkt 1'];

export default function SchwerpunktePage() {
  const [schwerpunkt, setSchwerpunkt] = useState('');
  const [liste, setListe] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>(['Vorname','Familienname','Benutzername']);
  const [data, setData] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/students?limit=3000&fields=Schwerpunkte,Schwerpunkt,Schwerpunkt 1');
        const json = await res.json();
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
        for (const s of json.items || []) {
          let tokens: string[] = [];
          if (Array.isArray(s.Schwerpunkte)) tokens = tokens.concat(s.Schwerpunkte.map(String));
          else if (typeof s.Schwerpunkte === 'string') tokens = tokens.concat(splitString(s.Schwerpunkte));
          if (Array.isArray(s.Schwerpunkt)) tokens = tokens.concat(s.Schwerpunkt.map(String));
          else if (typeof s.Schwerpunkt === 'string') tokens = tokens.concat(splitString(s.Schwerpunkt));
          if (typeof s['Schwerpunkt 1'] === 'string') tokens = tokens.concat(splitString(s['Schwerpunkt 1']));
          tokens.forEach(pushToken);
        }
        const list = Array.from(uniqueMap.values())
          .filter(v => !/^schwerpunkt\s*\d+$/i.test(v) && !/^schwerpunkt$/i.test(v))
          .sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}));
        setListe(list);
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

  function hasAnySchwerpunkt(s: Student) {
    const sources: any[] = [];
    if (Array.isArray(s.Schwerpunkte)) sources.push(...s.Schwerpunkte);
    if (Array.isArray(s.Schwerpunkt)) sources.push(...s.Schwerpunkt);
    ['Schwerpunkte','Schwerpunkt','Schwerpunkt 1'].forEach(k => {
      if (typeof s[k] === 'string') sources.push(...s[k].split(/\r?\n|[;,+&|\\\/]/));
    });
    return sources.some(x => String(x).trim());
  }

  async function load() {
    setLoading(true); setError(null);
    try {
      const baseFields = new Set<string>([...selectedFields,'Schwerpunkte','Schwerpunkt','Schwerpunkt 1']);
      const params = new URLSearchParams({ limit: '3000', fields: Array.from(baseFields).join(',') });
      if (schwerpunkt) params.set('schwerpunkt', schwerpunkt);
      const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      let items: Student[] = json.items || [];
      if (!schwerpunkt) {
        items = items.filter(hasAnySchwerpunkt);
      }
      setData(items);
    } catch (e:any) {
      setError(e.message || 'Fehler'); setData([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [schwerpunkt, selectedFields.join(',')]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schwerpunkte</h1>
        <a href="/" className="text-sm text-blue-600 underline">Startseite</a>
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
              const rows = data.map(d => selectedFields.map(f => {
                let val = d[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (Array.isArray(val)) return val.join(', ');
                return val ?? '';
              }));
              exportExcel({ filenameBase: `schwerpunkt-${schwerpunkt}`, headers: selectedFields, rows });
            }} className="px-3 py-1 rounded bg-emerald-600 text-white text-xs">Excel</button>
            <button onClick={() => {
              const rows = data.map(d => selectedFields.map(f => {
                let val = d[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (Array.isArray(val)) return val.join(', ');
                return val ?? '';
              }));
              exportPDF({ filenameBase: `schwerpunkt-${schwerpunkt}`, headers: selectedFields, rows });
            }} className="px-3 py-1 rounded bg-red-600 text-white text-xs">PDF</button>
            <button onClick={() => {
              const rows = data.map(d => selectedFields.map(f => {
                let val = d[f];
                if (f === 'Geburtsdatum') val = fmtDate(val);
                if (Array.isArray(val)) val = val.join(', ');
                return val ?? '';
              }));
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
  {!schwerpunkt && !loading && !error && data.length === 0 && <div className="text-sm text-gray-500">Keine Schüler mit Schwerpunkt gefunden.</div>}
      </div>
    </div>
  );
}
