"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { StudentDoc } from '@/lib/mongodb';

type Student = StudentDoc;

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

  const CREATE_FIELDS: string[] = [
    'Vorname','Familienname','Nachname','Geburtsdatum',
    'Klasse','Klasse 25/26','Stufe 25/26',
    'Status','Besuchsjahr','Familien-ID','Geschlecht',
    'Klasse 22/23','Klasse 23/24','Muttersprache','Religion','Religon an/ab',
    'Angebote','Frühbetreuung','Schwerpunkt 1','Schwerpunkte','Benutzername','Passwort','Sokrates ID'
  ];

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

  const HIDDEN = new Set(['_id','createdAt','updatedAt','deletedAt','_deleted','NormBenutzername','Stufe 24/25','Stufe 24/25_1','Klasse 24/25','Klasse 24/25_1','PasswortHash']);
  function orderedKeys(s: Student) {
    const keys = Object.keys(s || {}).filter(k => !HIDDEN.has(k));
    const pref = ['Vorname','Familienname','Nachname','Geburtsdatum','Klasse','Klasse 25/26','Klasse25','Klasse26','Status','Angebote','Benutzername','Passwort'];
    return [...pref.filter(k=>keys.includes(k)), ...keys.filter(k=>!pref.includes(k))];
  }

  function next() { setIndex(i => Math.min(i + 1, results.length - 1)); }
  function prev() { setIndex(i => Math.max(i - 1, 0)); }

  useEffect(() => {
    if (current) {
      const clone: Student = { ...current };
      if (current._deleted) {
        CREATE_FIELDS.forEach(f => {
          if (!(f in clone)) clone[f] = (f === 'Angebote') ? [] : '';
        });
      }
      setDraft(clone);
      setDirty(false);
    } else {
      setDraft(null);
      setDirty(false);
    }
  }, [current]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Schüler Suche & Bearbeitung</h1>
        <Link href="/" className="text-sm text-blue-600 underline">Zur Startseite</Link>
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
          const empty: Student = {} as Student;
          CREATE_FIELDS.forEach(f=>{ (empty as any)[f] = ''; });
          (empty as any).Angebote = [];
          setDraft(empty);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {((creating || draft._deleted) ? CREATE_FIELDS : orderedKeys(draft as Student)).map(k => {
              const val = (draft as any)[k];
              const isObj = typeof val === 'object' && val !== null && !Array.isArray(val);
              const isArray = Array.isArray(val);
              const displayVal = k==='Angebote' && isArray ? (val as unknown[]).join(', ') : isObj ? JSON.stringify(val, null, 2) : (val ?? '');
              function update(raw: string) {
                const next = { ...(draft as any) } as any;
                if (k === 'Angebote') {
                  const arr = raw.split(',').map(s=>s.trim()).filter(Boolean);
                  next[k] = arr;
                } else if (k === 'Frühbetreuung') {
                  next[k] = raw.trim();
                } else if (k === 'Geburtsdatum') {
                  next[k] = raw.slice(0,10);
                } else if (k === 'Passwort') {
                  next[k] = raw;
                } else if (isObj) {
                  try { next[k] = raw.trim() ? JSON.parse(raw) : null; } catch {}
                } else {
                  next[k] = raw;
                }
                setDraft(next); setDirty(true);
              }
              return (
                <div key={k} className="p-1">
                  <div className="font-semibold text-gray-600 mb-1">{k}</div>
                  <div>
                    {k === 'Geburtsdatum' ? (
                      <input type="date" className="w-full border rounded px-2 py-1 font-mono text-xs" value={displayVal ? String(displayVal).slice(0,10) : ''} onChange={e=>update(e.target.value)} />
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
                      const v = (draft as any)[k];
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
                    for (const k of orderedKeys(draft as Student)) payload[k] = (draft as any)[k];
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
