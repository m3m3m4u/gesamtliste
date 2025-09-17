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

  // Spaltenauswahl wie bei /klassenliste
  const FIELD_OPTIONS: string[] = [
    'Nr.','Vorname','Familienname','Klasse','Stufe','Status','Besuchsjahr','Religion','Angebote','Schwerpunkte','Benutzername','Passwort','Muttersprache','Geburtsdatum','Anton'
  ];
  const [selectedFields, setSelectedFields] = React.useState<string[]>(['Vorname','Familienname','Klasse','Stufe','Status','Besuchsjahr','Religion']);
  function toggleField(f: string) {
    setSelectedFields(prev => prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f]);
  }

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
    const headersAll = selectedFields.slice();
    const hasNr = headersAll.includes('Nr.');
    const headers = hasNr ? (['Nr.', ...headersAll.filter(h=>h!=='Nr.')]) : headersAll;
    const rows = sortedItems.map((it, idx) => headers.map(h => h==='Nr.' ? String(idx+1) : cellValue(it, h)));
    const cfg = { filenameBase: 'liste', headers, rows } as const;
    try {
      if (kind === 'excel') exportExcel(cfg);
  else if (kind === 'pdf') (async()=>{ await exportPDF(cfg); })();
      else exportWord({ ...cfg, title: 'Liste', word: { zebra: true } });
    } finally {
      setTimeout(() => { setExporting(null); setExportDone(kind); setTimeout(()=>setExportDone(null), 1200); }, 200);
    }
  };

  // Helfer: Zellenwert und Sortierwert
  function cellValue(it: Student, key: string): string {
    const rec = it as Record<string, unknown>;
    let v: unknown;
    switch (key) {
      case 'Vorname': v = it.Vorname; break;
      case 'Familienname': v = it.Familienname ?? it.Nachname; break;
      case 'Klasse': v = it['Klasse 25/26'] ?? it.Klasse; break;
      case 'Stufe': v = it['Stufe 25/26']; break;
      case 'Besuchsjahr': v = it.Besuchsjahr; break;
      default: v = rec[key];
    }
    // Normalisierung Mehrfachfelder (Angebote/Schwerpunkte) falls als String gespeichert
    if ((key === 'Angebote' || key === 'Schwerpunkte') && !Array.isArray(v) && typeof v === 'string') {
      const s = v.trim();
      if (s) {
        v = s.split(/[,;/\n\r\t]+/).map(x=>x.trim()).filter(Boolean);
      } else {
        v = [];
      }
    }
    if (Array.isArray(v)) return (v as unknown[]).map(x=>String(x).trim()).filter(Boolean).join(', ');
    if (v == null) return '';
    if (key === 'Geburtsdatum' && typeof v === 'string') {
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[3]}.${m[2]}.${m[1]}`;
    }
    return String(v);
  }
  function sortVal(v: string, key: string): string {
    if (key === 'Angebote' || key === 'Schwerpunkte') {
      // Für stabile Sortierung: einzelnes String-Feld in Kleinbuchstaben
      return v.toLowerCase();
    }
    if (key === 'Geburtsdatum') {
      const m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (m) return `${m[3]}${m[2]}${m[1]}`;
    }
    return v.toLowerCase();
  }
  // Sortierung dynamisch basierend auf ausgewählten Feldern
  const [sortField, setSortField] = React.useState<string | null>('Familienname');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('asc');
  const sortedItems = React.useMemo(()=>{
    if (!sortField) return items;
    const arr = [...items];
    arr.sort((a,b)=>{
      const av = sortVal(cellValue(a, sortField), sortField);
      const bv = sortVal(cellValue(b, sortField), sortField);
      if (av < bv) return sortDir==='asc' ? -1 : 1;
      if (av > bv) return sortDir==='asc' ? 1 : -1;
      // Tiebreaker
      const af = sortVal(cellValue(a,'Familienname'),'Familienname');
      const bf = sortVal(cellValue(b,'Familienname'),'Familienname');
      if (af !== bf) return af.localeCompare(bf,'de');
      const avn = sortVal(cellValue(a,'Vorname'),'Vorname');
      const bvn = sortVal(cellValue(b,'Vorname'),'Vorname');
      return avn.localeCompare(bvn,'de');
    });
    return arr;
  }, [items, sortField, sortDir]);
  function toggleSort(field: string) {
    if (sortField !== field) { setSortField(field); setSortDir('asc'); }
    else { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
  }
  function th(label: string){
    const active = sortField===label;
    if (label === 'Nr.') {
      return (
        <th className="border px-2 py-1 text-left select-none">{label}</th>
      );
    }
    return (
      <th className={"border px-2 py-1 text-left cursor-pointer select-none "+(active? 'bg-blue-50':'')} onClick={()=>toggleSort(label)}>
        {label}{active && <span className="ml-1 text-xs">{sortDir==='asc'?'▲':'▼'}</span>}
      </th>
    );
  }
  return (
    <form onSubmit={onSearch} className="mb-3 flex flex-wrap items-end gap-3 pt-6">
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

      <div className="w-full" />
      <div className="w-full">
        <label className="block text-xs font-semibold mb-1">Felder</label>
        <div className="flex flex-wrap gap-2">
          {FIELD_OPTIONS.map(f => (
            <label key={f} className="flex items-center gap-1 text-xs border rounded px-2 py-1 bg-white">
              <input type="checkbox" checked={selectedFields.includes(f)} onChange={()=>toggleField(f)} />
              {f}
            </label>
          ))}
        </div>
      </div>
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
              {(selectedFields.includes('Nr.') ? ['Nr.', ...selectedFields.filter(f=>f!=='Nr.')] : selectedFields).map(f => (
                <React.Fragment key={f}>{th(f)}</React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((it: Student, idx: number) => (
              <tr key={it._id} className="odd:bg-white even:bg-gray-50">
                {(selectedFields.includes('Nr.') ? ['Nr.', ...selectedFields.filter(f=>f!=='Nr.')] : selectedFields).map(f => (
                  <td key={f} className="border px-2 py-1">{f==='Nr.' ? (idx+1) : cellValue(it, f)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}

function Results(){ return null }
