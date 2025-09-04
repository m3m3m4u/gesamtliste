"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { StudentDoc } from '@/lib/mongodb';

type Student = StudentDoc;
type PartialStudent = Student & Record<string, unknown>;

// Stabil: Reihenfolge der Eingabefelder (außerhalb der Komponente, damit sich die Referenz nicht bei jedem Render ändert)
const CREATE_FIELDS: string[] = [
  // Reihenfolge: Frühbetreuung direkt unter Schwerpunkte, Angebote danach (breit)
  'Vorname','Familienname','Geburtsdatum',
  'Klasse 25/26','Stufe 25/26','Besuchsjahr',
  'Muttersprache','Religion','Geschlecht',
  'Schwerpunkte','Frühbetreuung','Angebote',
  'Benutzername','Passwort','Anton',
  'Sokrates ID','Familien-ID','Status'
];

function ToggleMulti({value, onChange, options, color='green'}: {value: string[]; onChange:(v:string[])=>void; options: string[]; color?: 'green'|'blue'|'emerald'}) {
  function toggle(item: string){
    const set = new Set(value);
    if(set.has(item)) set.delete(item); else set.add(item);
    onChange(Array.from(set));
  }
  const activeCls = color==='green'
    ? 'bg-green-600 text-white border border-green-700'
    : color==='blue'
      ? 'bg-blue-600 text-white border border-blue-700'
      : 'bg-emerald-600 text-white border border-emerald-700';
  const inactiveCls = 'bg-gray-100 hover:bg-gray-200 border border-gray-300';
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(o=>{
        const act = value.includes(o);
        return (
          <button type="button" key={o} onClick={()=>toggle(o)} className={`px-2 py-1 rounded text-xs transition select-none ${act? activeCls : inactiveCls}`}>{o}</button>
        );
      })}
      {options.length===0 && <span className="text-xs text-gray-400">(keine Optionen)</span>}
    </div>
  );
}

export default function Schueler() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Student[]>([]);
  const [index, setIndex] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Student | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [angebotOptionen, setAngebotOptionen] = useState<string[]>([]);
  const [schwerpunktOptionen, setSchwerpunktOptionen] = useState<string[]>([]);
  const [fruehOptionen, setFruehOptionen] = useState<string[]>([]);
  const [religionOptionen, setReligionOptionen] = useState<string[]>([]);
  const [statusOptionen, setStatusOptionen] = useState<string[]>([]);
  const [klassenOptionen, setKlassenOptionen] = useState<string[]>([]);
  const [sprachenOptionen, setSprachenOptionen] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/students/distincts');
        if(res.ok){
          const json = await res.json();
          if(Array.isArray(json.angebote)) setAngebotOptionen(json.angebote);
          if(Array.isArray(json.schwerpunkte)) setSchwerpunktOptionen(json.schwerpunkte);
          if(Array.isArray(json.fruehbetreuung)) setFruehOptionen(json.fruehbetreuung);
          if(Array.isArray(json.religionen)) setReligionOptionen(json.religionen);
          if(Array.isArray(json.status)) setStatusOptionen(json.status);
          if(Array.isArray(json.klassen)) setKlassenOptionen(json.klassen);
          if(Array.isArray(json.sprachen)) setSprachenOptionen(json.sprachen);
        }
      } catch {}
    })();
  }, []);

  async function loadByQuery(query: string) {
    setLoading(true); setMsg(null);
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: '200', onlyNames: '1' });
      if (showDeleted) params.set('includeDeleted','1');
      const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const items: Student[] = data.items || [];
      setResults(items); setIndex(0);
      if (!items.length) setMsg('Keine Treffer');
    } catch (e) { setResults([]); setIndex(0); setMsg((e as Error).message || 'Fehler'); }
    finally { setLoading(false); }
  }

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) { setResults([]); setIndex(0); setMsg(null); return; }
    await loadByQuery(q);
  }

  const current = results[index];

  const HIDDEN = new Set(['_id','createdAt','updatedAt','deletedAt','_deleted','NormBenutzername','Stufe 24/25','Stufe 24/25_1','Klasse 24/25','Klasse 24/25_1','Schwerpunkt 1','Klasse 22/23','Klasse 23/24','ImportStamp']);
  function orderedKeys(s: Student) {
    const keys = Object.keys(s || {}).filter(k => !HIDDEN.has(k));
    // Präferenzliste um Reihenfolge beizubehalten (erste Elemente werden oben/links gerendert)
    const pref = [
      'Vorname','Familienname','Geburtsdatum',
      'Klasse 25/26','Stufe 25/26','Besuchsjahr',
      'Muttersprache','Religion','Geschlecht',
      'Schwerpunkte','Frühbetreuung','Angebote',
      'Benutzername','Passwort','Anton',
      'Sokrates ID','Familien-ID','Status'
    ];
    return [...pref.filter(k=>keys.includes(k)), ...keys.filter(k=>!pref.includes(k))];
  }

  function next() { setIndex(i => Math.min(i + 1, results.length - 1)); }
  function prev() { setIndex(i => Math.max(i - 1, 0)); }

  useEffect(() => {
    if (current) {
      const clone: PartialStudent = { ...(current as PartialStudent) };
      // Normalisieren: Schwerpunkte / Frühbetreuung / Angebote als Arrays
  const toArr = (v: unknown): string[] => {
        if (Array.isArray(v)) return v.map(x=>String(x).trim()).filter(Boolean);
        if (v == null) return [];
        const s = String(v).trim();
        if (!s) return [];
        // Split bei gängigen Separatoren
        return s.split(/[,;/\n\r\t]+/).map(x=>x.trim()).filter(Boolean);
      };
      clone.Angebote = toArr(clone.Angebote);
      clone.Schwerpunkte = toArr(clone.Schwerpunkte ?? clone.Schwerpunkt);
      clone['Frühbetreuung'] = toArr(clone['Frühbetreuung']);
      if (current._deleted) {
        CREATE_FIELDS.forEach(f => {
          if (!(f in clone)) (clone as PartialStudent)[f] = (f === 'Angebote' || f==='Schwerpunkte' || f==='Frühbetreuung') ? [] : '';
        });
      }
      setDraft(clone as Student);
      setDirty(false);
    } else {
      setDraft(null);
      setDirty(false);
    }
  }, [current]);

  // Ensure we display important fields (like Passwort) even when they're missing
  const keysToRender = (creating || (draft && (draft as PartialStudent)._deleted))
    ? CREATE_FIELDS
    // Ensure CREATE_FIELDS defines the primary order so grouping stays stable
    : Array.from(new Set([ ...CREATE_FIELDS, ...(draft ? orderedKeys(draft as Student) : []) ]));

  return (
  <div className="w-full max-w-4xl mx-auto p-6 pt-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Schüler Suche & Bearbeitung</h1>
  <Link href="/" className="text-sm text-blue-600 underline">Zur Übersicht</Link>
      </div>
      <form onSubmit={search} className="flex flex-wrap gap-3 items-center">
        <input className="border rounded px-3 py-2 flex-1 min-w-[240px]" placeholder="Suche (Vorname / Familienname)" value={q} onChange={e=>setQ(e.target.value)} />
        <button disabled={!q.trim() || loading} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 text-sm">{loading ? '...' : 'Suchen'}</button>
        <label className="flex items-center gap-2 text-xs select-none">
          <input type="checkbox" checked={showDeleted} onChange={()=>{setShowDeleted(v=>!v); if(q.trim()) loadByQuery(q);}} />
          Papierkorb anzeigen
        </label>
        <button type="button" onClick={()=>{
          setCreating(true);
          const empty = {} as PartialStudent;
          CREATE_FIELDS.forEach(f=>{ empty[f] = ''; });
          empty.Angebote = [];
          setDraft(empty as Student);
          setDirty(false);
          setMsg(null);
        }} className="border px-3 py-2 rounded text-xs bg-white hover:bg-gray-50">Neu</button>
        {creating && (
          <button type="button" onClick={()=>{ setCreating(false); setDraft(null); }} className="border px-3 py-2 rounded text-xs">Abbrechen</button>
        )}
      </form>

      {results.length > 0 && (
        <div className="flex justify-between items-center text-sm">
          <div>Treffer: {results.length} | Datensatz: {index + 1}</div>
          <div className="flex gap-2">
            <button onClick={prev} disabled={index===0} className="border px-3 py-1 rounded disabled:opacity-40">Zurück</button>
            <button onClick={next} disabled={index===results.length-1} className="border px-3 py-1 rounded disabled:opacity-40">Weiter</button>
          </div>
        </div>
      )}

      {msg && <div className="text-sm">{msg}</div>}

      {draft && (
        <div className="border rounded bg-white p-4">
          <div className="flex items-center justify-between mb-4 text-sm">
            <h2 className="font-semibold">{creating ? 'Neuer Schüler' : 'Schülereintrag'}</h2>
            {!creating && current && <span className="text-xs text-gray-500">{current._deleted ? 'Im Papierkorb' : 'Aktiv'}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            {keysToRender.map(k => {
                const val = (draft as PartialStudent)[k];
              const isObj = typeof val === 'object' && val !== null && !Array.isArray(val);
              const isArray = Array.isArray(val);
              const displayVal = (k==='Angebote' || k==='Schwerpunkte' || k==='Frühbetreuung') && isArray ? (val as unknown[]).join(', ') : isObj ? JSON.stringify(val, null, 2) : (val ?? '');
              function update(raw: string) {
                  const next = { ...(draft as PartialStudent) } as PartialStudent;
                if (k === 'Angebote' || k==='Schwerpunkte' || k==='Frühbetreuung') {
                  const arr = raw.split(',').map(s=>s.trim()).filter(Boolean);
                  next[k] = arr;
                } else if (k === 'Geburtsdatum') {
                  next[k] = raw.slice(0,10);
                } else if (k === 'Passwort') {
                  next[k] = raw;
                } else if (isObj) {
                  try { next[k] = raw.trim() ? JSON.parse(raw) : null; } catch {}
                } else {
                  next[k] = raw;
                }
                  setDraft(next as Student); setDirty(true);
              }
              return (
                <div key={k} className={`p-1 ${['Angebote','Frühbetreuung','Schwerpunkte'].includes(k)?'sm:col-span-3':''} ${['Benutzername','Passwort','Anton'].includes(k)?'':''} `}> 
                  <div className="font-semibold text-gray-600 mb-1">{k}</div>
                  <div>
                    {k === 'Geburtsdatum' ? (
                      <input type="date" className="w-full border rounded px-2 py-1 font-mono text-xs" value={displayVal ? String(displayVal).slice(0,10) : ''} onChange={e=>update(e.target.value)} />
                    ) : k === 'Klasse 25/26' ? (
                      <select className="w-full border rounded px-2 py-1 font-mono text-xs" value={String(displayVal)} onChange={e=>update(e.target.value)}>
                        <option value=""></option>
                        {klassenOptionen.map(c=> <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : k === 'Geschlecht' ? (
                      <select className="w-full border rounded px-2 py-1 font-mono text-xs" value={String(displayVal)} onChange={e=>update(e.target.value)}>
                        <option value=""></option>
                        <option value="m">m</option>
                        <option value="w">w</option>
                        <option value="d">d</option>
                      </select>
                    ) : k === 'Religion' ? (
                      <select className="w-full border rounded px-2 py-1 font-mono text-xs" value={String(displayVal)} onChange={e=>update(e.target.value)}>
                        <option value=""></option>
                        {religionOptionen.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : k === 'Muttersprache' ? (
                      <select className="w-full border rounded px-2 py-1 font-mono text-xs" value={String(displayVal)} onChange={e=>update(e.target.value)}>
                        <option value=""></option>
                        {sprachenOptionen.map(s => <option key={s} value={s}>{s}</option>)}
                        {displayVal && !sprachenOptionen.includes(String(displayVal)) && <option value={String(displayVal)}>{String(displayVal)}</option>}
                      </select>
                    ) : k === 'Status' ? (
                      <select className="w-full border rounded px-2 py-1 font-mono text-xs" value={String(displayVal)} onChange={e=>update(e.target.value)}>
                        <option value=""></option>
                        {statusOptionen.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : k === 'Schwerpunkte' ? (
                      <div className="space-y-1">
                        <ToggleMulti value={Array.isArray(val)? val as string[] : []} options={schwerpunktOptionen} color="green" onChange={(arr)=>{
                          const next = { ...(draft as PartialStudent) } as PartialStudent; next[k] = arr; setDraft(next as Student); setDirty(true);
                        }} />
                        {schwerpunktOptionen.length===0 && <div className="text-xs text-amber-600">(Noch keine Schwerpunkte definiert – später in Optionen ergänzen)</div>}
                      </div>
                    ) : k === 'Frühbetreuung' ? (
                      <div className="space-y-1">
                        <ToggleMulti value={Array.isArray(val)? val as string[] : []} options={fruehOptionen} color="green" onChange={(arr)=>{
                          const next = { ...(draft as PartialStudent) } as PartialStudent; next[k] = arr; setDraft(next as Student); setDirty(true);
                        }} />
                        {fruehOptionen.length===0 && <div className="text-xs text-amber-600">(Noch keine Frühbetreuungs-Optionen definiert)</div>}
                      </div>
                    ) : k === 'Angebote' ? (
                      <div className="space-y-1">
                        <ToggleMulti value={Array.isArray(val)? val as string[] : []} options={angebotOptionen} color="green" onChange={(arr)=>{
                          const next = { ...(draft as PartialStudent) } as PartialStudent; next[k] = arr; setDraft(next as Student); setDirty(true);
                        }} />
                        {angebotOptionen.length===0 && <div className="text-xs text-amber-600">(Noch keine Angebote definiert)</div>}
                      </div>
                    ) : isObj || (isArray && k === 'Angebote') || String(displayVal).length > 60 ? (
                      <textarea className="w-full border rounded px-2 py-1 font-mono text-xs min-h-[60px]" value={String(displayVal)} onChange={e=>update(e.target.value)} />
                    ) : (
                      <input className="w-full border rounded px-2 py-1 font-mono text-xs" value={String(displayVal)} onChange={e=>update(e.target.value)} type={k === 'Passwort' ? 'text' : 'text'} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap gap-3 justify-end items-center">
            {creating ? (
              <>
        <button disabled={saving} onClick={async ()=>{
                  if(!draft) return; setSaving(true); setMsg(null);
                  try {
                    const payload: Record<string, unknown> = {};
                    CREATE_FIELDS.forEach(k=>{
          const v = (draft as PartialStudent)[k];
                      if(Array.isArray(v)) {
                        payload[k] = v;
                      } else if(typeof v === 'string') {
                        if(k === 'Geburtsdatum' && v) payload[k] = v.slice(0,10); else payload[k] = v;
                      } else if(v != null) {
                        payload[k] = v;
                      } else {
                        payload[k] = '';
                      }
                    });
                    if(!Array.isArray(payload.Angebote)) payload.Angebote = [];
                    const res = await fetch('/api/students', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
                    if(!res.ok) throw new Error(await res.text());
                    const created = await res.json();
                    setMsg('Angelegt');
                    setCreating(false); setDirty(false);
                    setResults([created]); setIndex(0); setDraft(created);
                  } catch(e){ setMsg('Fehler beim Anlegen: '+ ((e as Error).message||'')); }
                  finally { setSaving(false); }
                }} className="px-4 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50">{saving? '...' : 'Speichern'}</button>
                <button disabled={saving} onClick={()=>{ setCreating(false); setDraft(null); setDirty(false); }} className="px-4 py-2 rounded border text-sm">Abbrechen</button>
              </>
            ) : current && (
              <>
                <button disabled={!dirty || saving} onClick={async () => {
                  if (!current?._id) return; setSaving(true); setMsg(null);
                  try {
                    const payload: Record<string, unknown> = {};
                    for (const k of orderedKeys(draft as Student)) payload[k] = (draft as PartialStudent)[k];
                    const res = await fetch(`/api/students/${current._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!res.ok) throw new Error(await res.text());
                    const updated = await res.json();
                    setResults(prev => prev.map((r,i)=> i===index ? { ...r, ...updated } : r));
                    setDirty(false); setMsg('Gespeichert');
                  } catch (e) { setMsg('Fehler beim Speichern: ' + ((e as Error).message||'')); }
                  finally { setSaving(false); }
                }} className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50">{saving ? '...' : 'Speichern'}</button>
                <button disabled={!dirty || saving} onClick={() => { if (current) { const clone: Student = { ...current }; setDraft(clone); setDirty(false); setMsg('Änderungen verworfen'); } }} className="px-4 py-2 rounded border">Abbrechen</button>
                {!current._deleted && (
                  <button disabled={saving} onClick={async ()=>{
                    if(!current?._id) return; setSaving(true); setMsg(null);
                    try { const res = await fetch(`/api/students/${current._id}`, { method:'DELETE' }); if(!res.ok) throw new Error(await res.text()); const upd = await res.json(); setResults(prev=> prev.map((r,i)=> i===index ? { ...r, ...upd } : r)); setDraft(prev=> prev? { ...prev, _deleted:true } : prev); setMsg('In Papierkorb verschoben'); }
                    catch(e){ setMsg('Fehler beim Löschen: '+ ((e as Error).message||'')); }
                    finally { setSaving(false); }
                  }} className="px-4 py-2 rounded bg-rose-600 text-white">Löschen</button>
                )}
                {current._deleted && (
                  <button disabled={saving} onClick={async ()=>{
                    if(!current?._id) return; setSaving(true); setMsg(null);
                    try { const res = await fetch(`/api/students/${current._id}/restore`, { method:'POST' }); if(!res.ok) throw new Error(await res.text()); const upd = await res.json(); setResults(prev=> prev.map((r,i)=> i===index ? { ...r, ...upd } : r)); setDraft(prev=> prev? { ...prev, _deleted:false, deletedAt: undefined } : prev); setMsg('Wiederhergestellt'); }
                    catch(e){ setMsg('Fehler beim Wiederherstellen: '+ ((e as Error).message||'')); }
                    finally { setSaving(false); }
                  }} className="px-4 py-2 rounded bg-amber-600 text-white">Wiederherstellen</button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!draft && !loading && results.length === 0 && q && <div className="text-sm text-gray-500">Keine Treffer</div>}
      {!draft && !q && <div className="text-sm text-gray-400">Suchbegriff eingeben oder Neu für neuen Schüler.</div>}
    </div>
  );
}
