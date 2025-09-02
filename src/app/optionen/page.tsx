"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type Lists = { angebote: string[]; schwerpunkte: string[]; fruehbetreuung: string[]; status: string[]; religionen: string[]; klassen: string[]; sprachen: string[] };

export default function OptionenPage(){
  const [data,setData] = useState<Lists>({ angebote:[], schwerpunkte:[], fruehbetreuung:[], status:[], religionen:[], klassen:[], sprachen:[] });
  const [dirty,setDirty] = useState(false);
  const [raw,setRaw] = useState<any>({ angebote:'', schwerpunkte:'', fruehbetreuung:'', status:'', religionen:'', klassen:'', sprachen:'' });
  const [saving,setSaving] = useState(false);
  const [msg,setMsg] = useState<string|null>(null);

  useEffect(()=>{ (async()=>{ try { const r = await fetch('/api/options',{cache:'no-store'}); if(r.ok){ const j = await r.json(); const lists: Lists = { angebote:j.angebote||[], schwerpunkte:j.schwerpunkte||[], fruehbetreuung:j.fruehbetreuung||[], status:j.status||[], religionen:j.religionen||[], klassen:j.klassen||[], sprachen:j.sprachen||[] }; setData(lists); setRaw({ angebote: lists.angebote.join('\n'), schwerpunkte: lists.schwerpunkte.join('\n'), fruehbetreuung: lists.fruehbetreuung.join('\n'), status: lists.status.join('\n'), religionen: lists.religionen.join('\n'), klassen: lists.klassen.join('\n'), sprachen: lists.sprachen.join('\n') }); } } catch{} })(); },[]);
  useEffect(()=>{ (async()=>{ try {
    const d = await fetch('/api/students/distincts',{cache:'no-store'}); if(d.ok){ const dj = await d.json();
      setData(prev=>{ const next = { ...prev };
        if(Array.isArray(dj.klassen) && prev.klassen.length===0) next.klassen = dj.klassen;
        if(Array.isArray(dj.religionen)) {
          const set = new Set(prev.religionen);
            dj.religionen.forEach((r: string)=>{ if(r && !set.has(r)) { set.add(r); } });
          next.religionen = Array.from(set);
        }
        if(Array.isArray(dj.sprachen)) {
          const setS = new Set(prev.sprachen);
          dj.sprachen.forEach((s: string)=>{ if(s && !setS.has(s)) setS.add(s); });
          next.sprachen = Array.from(setS);
        }
  setRaw((r: any)=>({ ...r, religionen: next.religionen.join('\n'), klassen: next.klassen.join('\n'), sprachen: next.sprachen.join('\n') }));
        return next;
      });
    }
  } catch{} })(); }, []);

  function upd(key: keyof Lists, text: string){
    // Leere Zeilen im Raw erhalten, aber nicht als Eintrag speichern
  setRaw((r: any)=>({ ...r, [key]: text }));
    const arr = text.replace(/\r/g,'').split('\n').filter(line=>line.length>0);
    setData(d=>({ ...d, [key]: arr }));
    setDirty(true); setMsg(null);
  }

  async function save(){
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/options',{ method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
      if(!res.ok) throw new Error(await res.text());
  const j = await res.json(); const lists: Lists = { angebote:j.angebote||[], schwerpunkte:j.schwerpunkte||[], fruehbetreuung:j.fruehbetreuung||[], status:j.status||[], religionen:j.religionen||[], klassen:j.klassen||[], sprachen:j.sprachen||[] }; setData(lists); setRaw({ angebote: lists.angebote.join('\n'), schwerpunkte: lists.schwerpunkte.join('\n'), fruehbetreuung: lists.fruehbetreuung.join('\n'), status: lists.status.join('\n'), religionen: lists.religionen.join('\n'), klassen: lists.klassen.join('\n'), sprachen: lists.sprachen.join('\n') });
  setDirty(false); setMsg('Gespeichert');
    } catch(e){ setMsg('Fehler: '+((e as Error).message||'')); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Optionen verwalten</h1>
  <Link href="/" className="text-sm text-blue-600 underline">Zur Übersicht</Link>
      </div>
      <p className="text-sm text-gray-600">Eine Zeile pro Eintrag. Leere Zeilen werden ignoriert.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        <div>
          <div className="font-semibold mb-2">Schwerpunkte</div>
          <textarea className="w-full border rounded px-2 py-1 font-mono text-xs min-h-[220px]" value={raw.schwerpunkte} onChange={e=>upd('schwerpunkte', e.target.value)} />
        </div>
        <div>
          <div className="font-semibold mb-2">Frühbetreuung</div>
            <textarea className="w-full border rounded px-2 py-1 font-mono text-xs min-h-[220px]" value={raw.fruehbetreuung} onChange={e=>upd('fruehbetreuung', e.target.value)} />
        </div>
        <div>
          <div className="font-semibold mb-2">Angebote</div>
            <textarea className="w-full border rounded px-2 py-1 font-mono text-xs min-h-[220px]" value={raw.angebote} onChange={e=>upd('angebote', e.target.value)} />
        </div>
        <div>
          <div className="font-semibold mb-2">Status</div>
            <textarea className="w-full border rounded px-2 py-1 font-mono text-xs min-h-[220px]" value={raw.status} onChange={e=>upd('status', e.target.value)} />
        </div>
        <div>
          <div className="font-semibold mb-2">Religionen</div>
            <textarea className="w-full border rounded px-2 py-1 font-mono text-xs min-h-[220px]" value={raw.religionen} onChange={e=>upd('religionen', e.target.value)} />
        </div>
        <div>
          <div className="font-semibold mb-2">Klassen</div>
            <textarea className="w-full border rounded px-2 py-1 font-mono text-xs min-h-[220px]" value={raw.klassen} onChange={e=>upd('klassen', e.target.value)} />
        </div>
        <div>
          <div className="font-semibold mb-2">Sprachen (Muttersprache)</div>
            <textarea className="w-full border rounded px-2 py-1 font-mono text-xs min-h-[220px]" value={raw.sprachen} onChange={e=>upd('sprachen', e.target.value)} />
        </div>
      </div>

      {msg && <div className="text-xs text-gray-700">{msg}</div>}

      <div className="flex gap-3 justify-end">
        <button disabled={!dirty||saving} onClick={()=>save()} className="px-4 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50">{saving? '...' : 'Speichern'}</button>
  <button disabled={!dirty||saving} onClick={()=>{ setDirty(false); setMsg('Verworfen'); (async()=>{ try { const r = await fetch('/api/options',{cache:'no-store'}); if(r.ok){ const j = await r.json(); const lists: Lists = { angebote:j.angebote||[], schwerpunkte:j.schwerpunkte||[], fruehbetreuung:j.fruehbetreuung||[], status:j.status||[], religionen:j.religionen||[], klassen:j.klassen||[], sprachen:j.sprachen||[] }; setData(lists); setRaw({ angebote: lists.angebote.join('\n'), schwerpunkte: lists.schwerpunkte.join('\n'), fruehbetreuung: lists.fruehbetreuung.join('\n'), status: lists.status.join('\n'), religionen: lists.religionen.join('\n'), klassen: lists.klassen.join('\n'), sprachen: lists.sprachen.join('\n') }); } } catch{} })(); }} className="px-4 py-2 rounded border text-sm">Verwerfen</button>
      </div>
    </div>
  );
}
