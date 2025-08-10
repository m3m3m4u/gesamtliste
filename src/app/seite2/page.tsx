"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { StudentDoc } from '@/lib/mongodb';

type Student = StudentDoc;

export default function Seite2() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Student[]>([]);
  const [index, setIndex] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Student | null>(null);
  const [dirty, setDirty] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) { setResults([]); setIndex(0); setMsg(null); return; }
    setLoading(true); setMsg(null);
    try {
  const params = new URLSearchParams({ q: q.trim(), limit: '200', onlyNames: '1' });
      const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const items: Student[] = data.items || [];
      setResults(items);
      setIndex(0);
      if (!items.length) setMsg('Keine Treffer');
    } catch (e) {
      setResults([]); setIndex(0); setMsg((e as Error).message || 'Fehler');
    } finally { setLoading(false); }
  }

  const current = results[index];

  const HIDDEN = new Set(['_id','createdAt','updatedAt','NormBenutzername','Stufe 24/25','Stufe 24/25_1','Klasse 24/25','Klasse 24/25_1','PasswortHash']);
  function orderedKeys(s: Student) {
    const keys = Object.keys(s || {}).filter(k => !HIDDEN.has(k));
    const pref = ['Vorname','Familienname','Nachname','Geburtsdatum','Klasse','Klasse 25/26','Klasse25','Klasse26','Status','Angebote','Benutzername','Passwort'];
    return [...pref.filter(k=>keys.includes(k)), ...keys.filter(k=>!pref.includes(k))];
  }

  function next() { setIndex(i => Math.min(i + 1, results.length - 1)); }
  function prev() { setIndex(i => Math.max(i - 1, 0)); }

  useEffect(() => {
    if (current) { const clone: Student = { ...current }; setDraft(clone); setDirty(false); }
    else { setDraft(null); setDirty(false); }
  }, [current]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Schüler Suche & Bearbeitung</h1>
  <Link href="/" className="text-sm text-blue-600 underline">Zur Startseite</Link>
      </div>
      <form onSubmit={search} className="flex gap-2">
  <input className="border rounded px-3 py-2 flex-1" placeholder="Suche (Vorname / Familienname)" value={q} onChange={e=>setQ(e.target.value)} />
        <button disabled={!q.trim() || loading} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{loading ? '...' : 'Suchen'}</button>
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

      {current && draft && (
        <div className="border rounded bg-white p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
            {orderedKeys(draft).map(k => {
              const val = draft[k];
              const isObj = typeof val === 'object' && val !== null && !Array.isArray(val);
              const isArray = Array.isArray(val);
              const displayVal = k==='Angebote' && isArray ? (val as any[]).join(', ') : isObj ? JSON.stringify(val, null, 2) : (val ?? '');
              function update(raw: string) {
                const next = { ...draft };
                if (k === 'Angebote') {
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
                setDraft(next); setDirty(true);
              }
              return (
                <React.Fragment key={k}>
                  <div className="col-span-1 font-semibold text-gray-600 break-words pr-2">{k}</div>
                  <div className="sm:col-span-2 col-span-1">
                    {k === 'Geburtsdatum' ? (
                      <input type="date" className="w-full border rounded px-2 py-1 font-mono text-xs" value={displayVal ? String(displayVal).slice(0,10) : ''} onChange={e=>update(e.target.value)} />
                    ) : isObj || (isArray && k === 'Angebote') || String(displayVal).length > 60 ? (
                      <textarea className="w-full border rounded px-2 py-1 font-mono text-xs min-h-[60px]" value={String(displayVal)} onChange={e=>update(e.target.value)} />
                    ) : (
                      <input className="w-full border rounded px-2 py-1 font-mono text-xs" value={String(displayVal)} onChange={e=>update(e.target.value)} type={k === 'Passwort' ? 'text' : 'text'} />
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <div className="mt-6 flex gap-3 justify-end">
            <button disabled={!dirty || saving} onClick={async () => {
              if (!current?._id) return; setSaving(true); setMsg(null);
              try {
                const payload: Record<string, any> = {};
                for (const k of orderedKeys(draft)) payload[k] = draft[k];
                const res = await fetch(`/api/students/${current._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) throw new Error(await res.text());
                const updated = await res.json();
                setResults(prev => prev.map((r,i)=> i===index ? { ...r, ...updated } : r));
                setDirty(false); setMsg('Gespeichert');
              } catch (e) { setMsg('Fehler beim Speichern: ' + ((e as Error).message||'')); }
              finally { setSaving(false); }
            }} className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50">{saving ? '...' : 'Speichern'}</button>
            <button disabled={!dirty || saving} onClick={() => { if (current) { const clone: Student = { ...current }; setDraft(clone); setDirty(false); setMsg('Änderungen verworfen'); } }} className="px-4 py-2 rounded border">Abbrechen</button>
          </div>
        </div>
      )}

      {!current && !loading && results.length === 0 && q && <div className="text-sm text-gray-500">Keine Treffer</div>}
      {!current && !q && <div className="text-sm text-gray-400">Suchbegriff eingeben und Suchen.</div>}
    </div>
  );
}
