"use client";

import React from 'react';
import BackLink from '../statistik/BackLink';
import { exportExcel, exportPDF, exportWord } from '@/lib/exporters';

export default function ListenPage() {
  return (
    <div className="p-6">
      <BackLink />
      <h1 className="text-2xl font-bold mb-4">Listen</h1>
      <p className="text-gray-600 mb-2">Filter nach Stufe, Status, Besuchsjahr</p>
      <ListenClient />
    </div>
  );
}

type Student = {
  _id: string;
  Vorname?: string;
  Familienname?: string;
  Nachname?: string;
  Status?: string;
  Besuchsjahr?: string | number;
  Klasse?: string;
  ['Klasse 25/26']?: string;
  ['Stufe 25/26']?: string;
  Religion?: string;
};

function ListenClient() {
  return (
    <div className="w-full max-w-5xl">
      <FilterForm />
      <Results />
    </div>
  );
}

type MultiSelectProps = {
  label: string;
  options: string[];
  values: string[];
  onChange: (vals: string[]) => void;
  renderOption?: (v: string) => string;
  className?: string;
};

function MultiSelect({ label, options, values, onChange, renderOption, className }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const allSelected = values.length>0 && values.length === options.length;
  const shown = allSelected ? 'Alle' : (values.length ? values.map(v => (renderOption ? renderOption(v) : v)).join(', ') : 'Alle');
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const toggle = (val: string) => {
    const has = values.includes(val);
    const next = has ? values.filter(v => v !== val) : [...values, val];
    onChange(next);
  };
  const clearAll = () => onChange([]);
  const selectAll = () => onChange(options.slice());
  return (
    <div className={"relative " + (className || '')} ref={ref}>
      <label className="block text-sm text-gray-600 mb-0.5">{label}</label>
      <button type="button" onClick={()=>setOpen(o=>!o)} aria-haspopup="listbox" aria-expanded={open}
        className={"w-full border px-2 py-1 rounded text-left bg-white hover:bg-gray-50 focus:outline-none focus:ring focus:ring-blue-200 " + (open ? 'ring ring-blue-200' : '')}>
        <span className="truncate inline-block max-w-[14rem] align-middle">{shown}</span>
        <span className="float-right text-gray-500">▾</span>
      </button>
      {open && (
        <div role="listbox" className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-64 overflow-auto">
          <div className="sticky top-0 bg-white border-b px-2 py-1 flex gap-2 text-xs text-gray-600">
            <button type="button" className="underline" onClick={selectAll}>Alle</button>
            <button type="button" className="underline" onClick={clearAll}>Leeren</button>
          </div>
          {options.map(opt => {
            const label = renderOption ? renderOption(opt) : opt;
            const checked = values.includes(opt);
            return (
              <button key={opt} type="button" onClick={()=>toggle(opt)} className={`w-full text-left px-2 py-1 flex items-center gap-2 hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}>
                <input type="checkbox" readOnly checked={checked} className="pointer-events-none" />
                <span>{label}</span>
              </button>
            );
          })}
          {options.length === 0 && <div className="px-2 py-2 text-sm text-gray-500">Keine Optionen</div>}
        </div>
      )}
    </div>
  );
}

function FilterForm() {
  const [stufe, setStufe] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<string[]>([]);
  const [jahr, setJahr] = React.useState<string[]>([]);
  const [religion, setReligion] = React.useState<string[]>([]);
  const [klassen, setKlassen] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<Student[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [stufenOpt, setStufenOpt] = React.useState<string[]>([]);
  const [statusOpt, setStatusOpt] = React.useState<string[]>([]);
  const [jahreOpt, setJahreOpt] = React.useState<string[]>([]);
  const [religionOpt, setReligionOpt] = React.useState<string[]>([]);
  const [klassenOpt, setKlassenOpt] = React.useState<string[]>([]);
  const [exporting, setExporting] = React.useState<null | 'excel' | 'pdf' | 'word'>(null);
  const [exportDone, setExportDone] = React.useState<null | 'excel' | 'pdf' | 'word'>(null);

  const onSearch = React.useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
  stufe.forEach(s => p.append('stufe', s));
      status.forEach(s => p.append('status', s));
      jahr.forEach(j => p.append('jahr', j));
  religion.forEach(r => p.append('religion', r));
  klassen.forEach(k => p.append('klasse', k));
      p.set('limit', '2000');
      const res = await fetch(`/api/students?${p.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const msg = await res.text().catch(()=> 'Fehler beim Laden');
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [stufe, status, jahr, religion, klassen]);

  React.useEffect(() => { void onSearch(); }, [onSearch]);

  // Optionen laden
  React.useEffect(() => {
    (async () => {
      try {
  const res = await fetch('/api/students/distincts', { cache: 'no-store' });
        const d = await res.json();
        setStufenOpt(d.stufen || []);
        setStatusOpt(d.status || []);
    setJahreOpt(d.jahre || []);
  setReligionOpt(d.religionen || []);
    setKlassenOpt(d.klassen || []);
      } catch {}
    })();
  }, []);

  const doExport = (kind: 'excel' | 'pdf' | 'word') => {
    setExporting(kind);
    const headers = ['Vorname','Familienname','Klasse','Stufe','Status','Besuchsjahr','Religion'];
    const rows = items.map(it => [
      it.Vorname ?? '',
      it.Familienname || it.Nachname || '',
      it['Klasse 25/26'] || it.Klasse || '',
      it['Stufe 25/26'] || '',
      it.Status || '',
      String(it.Besuchsjahr ?? ''),
      it.Religion || ''
    ]);
    const cfg = { filenameBase: 'liste', headers, rows };
    try {
      if (kind === 'excel') exportExcel(cfg);
      else if (kind === 'pdf') exportPDF(cfg);
      else exportWord({ ...cfg, title: 'Liste', word: { zebra: true } });
    } finally {
      setTimeout(() => { setExporting(null); setExportDone(kind); setTimeout(()=>setExportDone(null), 1200); }, 200);
    }
  };

  // Sortierung
  const [sortKey, setSortKey] = React.useState<'Vorname'|'Familienname'|'Klasse'|'Stufe'|'Status'|'Besuchsjahr'|'Religion'>('Familienname');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('asc');
  const sortedItems = React.useMemo(()=>{
    const arr = [...items];
    arr.sort((a,b)=>{
      function val(it: Student, key: string){
        if(key==='Klasse') return (it['Klasse 25/26']||it.Klasse||'').toString();
        if(key==='Stufe') return (it['Stufe 25/26']||'').toString();
        if(key==='Besuchsjahr') return (it.Besuchsjahr||'').toString();
  return (it as Record<string, unknown>)[key] ? String((it as Record<string, unknown>)[key]) : '';
      }
      const va = val(a, sortKey);
      const vb = val(b, sortKey);
      return sortDir==='asc' ? va.localeCompare(vb,'de',{numeric:true,sensitivity:'base'}) : vb.localeCompare(va,'de',{numeric:true,sensitivity:'base'});
    });
    return arr;
  }, [items, sortKey, sortDir]);
  function toggleSort(key: typeof sortKey){
    setSortKey(prev=> prev===key ? prev : key);
    setSortDir(prev=> sortKey===key ? (prev==='asc'?'desc':'asc') : 'asc');
  }
  function th(label: string, key: typeof sortKey){
    const active = sortKey===key;
    return (
      <th className={"border px-2 py-1 text-left cursor-pointer select-none "+(active? 'bg-blue-50':'')} onClick={()=>toggleSort(key)}>
        {label}{active && <span className="ml-1 text-xs">{sortDir==='asc'?'▲':'▼'}</span>}
      </th>
    );
  }
  return (
    <form onSubmit={onSearch} className="mb-3 flex flex-wrap items-end gap-3">
      <MultiSelect label="Stufe" options={stufenOpt} values={stufe} onChange={setStufe} className="w-48"
        renderOption={(v)=> v === '0' ? '0 (leer)' : v} />
      <MultiSelect label="Status" options={statusOpt} values={status} onChange={setStatus} className="w-64" />
      <MultiSelect label="Besuchsjahr" options={jahreOpt} values={jahr} onChange={setJahr} className="w-48" />
  <MultiSelect label="Religion" options={religionOpt} values={religion} onChange={setReligion} className="w-48" />
      <MultiSelect label="Klasse" options={klassenOpt} values={klassen} onChange={setKlassen} className="w-48" />
      <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50" disabled={loading}>{loading? 'Laden…':'Filtern'}</button>
      <span className="text-gray-500 text-sm">Treffer: {items.length}</span>
  {/* Hinweis entfällt, da Checkbox-Dropdowns */}
      {error && <span className="text-red-600 text-sm">{error}</span>}

      <div className="ml-auto flex items-center gap-2">
        <button type="button" aria-pressed={exporting==='excel'} aria-busy={exporting==='excel'} disabled={exporting!==null}
          onClick={()=>doExport('excel')} className="px-3 py-1 border rounded flex items-center gap-2 disabled:opacity-50 active:translate-y-px">
          {exporting==='excel' && <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />}
          {exportDone==='excel' && <span className="text-green-600">✓</span>}
          Excel
        </button>
        <button type="button" aria-pressed={exporting==='pdf'} aria-busy={exporting==='pdf'} disabled={exporting!==null}
          onClick={()=>doExport('pdf')} className="px-3 py-1 border rounded flex items-center gap-2 disabled:opacity-50 active:translate-y-px">
          {exporting==='pdf' && <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />}
          {exportDone==='pdf' && <span className="text-green-600">✓</span>}
          PDF
        </button>
        <button type="button" aria-pressed={exporting==='word'} aria-busy={exporting==='word'} disabled={exporting!==null}
          onClick={()=>doExport('word')} className="px-3 py-1 border rounded flex items-center gap-2 disabled:opacity-50 active:translate-y-px">
          {exporting==='word' && <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />}
          {exportDone==='word' && <span className="text-green-600">✓</span>}
          Word
        </button>
      </div>

      <div className="w-full overflow-x-auto border mt-2">
        <table className="min-w-[700px] w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {th('Vorname','Vorname')}
              {th('Familienname','Familienname')}
              {th('Klasse','Klasse')}
              {th('Stufe','Stufe')}
              {th('Status','Status')}
              {th('Besuchsjahr','Besuchsjahr')}
              {th('Religion','Religion')}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((it: Student) => (
              <tr key={it._id} className="odd:bg-white even:bg-gray-50">
                <td className="border px-2 py-1">{it.Vorname}</td>
                <td className="border px-2 py-1">{it.Familienname || it.Nachname}</td>
                <td className="border px-2 py-1">{it['Klasse 25/26'] || it.Klasse}</td>
                <td className="border px-2 py-1">{it['Stufe 25/26']}</td>
                <td className="border px-2 py-1">{it.Status}</td>
                <td className="border px-2 py-1">{it.Besuchsjahr}</td>
                <td className="border px-2 py-1">{it.Religion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}

function Results(){ return null }
