"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type Lists = { angebote: string[]; schwerpunkte: string[]; fruehbetreuung: string[]; status: string[]; religionen: string[]; klassen: string[]; sprachen: string[] };

export default function OptionenPage(){
  const [data,setData] = useState<Lists>({ angebote:[], schwerpunkte:[], fruehbetreuung:[], status:[], religionen:[], klassen:[], sprachen:[] });
  const [dirty,setDirty] = useState(false);
  const [raw,setRaw] = useState<Record<keyof Lists,string>>({ angebote:'', schwerpunkte:'', fruehbetreuung:'', status:'', religionen:'', klassen:'', sprachen:'' });
  const [saving,setSaving] = useState(false);
  const [msg,setMsg] = useState<string|null>(null);

  useEffect(()=>{ (async()=>{
    try {
      // Beides parallel laden und danach deterministisch vereinigen -> vermeidet Race Condition
      const [optRes, distRes] = await Promise.all([
        fetch('/api/options',{cache:'no-store'}),
        fetch('/api/students/distincts',{cache:'no-store'})
      ]);
      const opt = optRes.ok ? await optRes.json() : {};
      const dist = distRes.ok ? await distRes.json() : {};
      const base: Lists = {
        angebote: opt.angebote||[],
        schwerpunkte: opt.schwerpunkte||[],
        fruehbetreuung: opt.fruehbetreuung||[],
        status: opt.status||[],
        religionen: opt.religionen||[],
        klassen: opt.klassen||[],
        sprachen: opt.sprachen||[]
      };
      // Union Felder
      function union(a: string[], b: string[]){ const s = new Set<string>(); [...a,...b].forEach(x=>{ const t=(x||'').trim(); if(t) s.add(t); }); return Array.from(s); }
      base.klassen = union(base.klassen, dist.klassen||[]).sort((a,b)=>a.localeCompare(b,'de'));
      base.religionen = union(base.religionen, dist.religionen||[]).sort((a,b)=>a.localeCompare(b,'de'));
      base.sprachen = union(base.sprachen, dist.sprachen||[]).sort((a,b)=>a.localeCompare(b,'de'));
      base.status = union(base.status, dist.status||[]).sort((a,b)=>a.localeCompare(b,'de'));
      setData(base);
      setRaw({
        angebote: base.angebote.join('\n'),
        schwerpunkte: base.schwerpunkte.join('\n'),
        fruehbetreuung: base.fruehbetreuung.join('\n'),
        status: base.status.join('\n'),
        religionen: base.religionen.join('\n'),
        klassen: base.klassen.join('\n'),
        sprachen: base.sprachen.join('\n')
      });
    } catch {}
  })(); },[]);

  function upd(key: keyof Lists, text: string){
    // Leere Zeilen im Raw erhalten, aber nicht als Eintrag speichern
  setRaw(r=>({ ...r, [key]: text }));
    const arr = text.replace(/\r/g,'').split('\n').filter(line=>line.length>0);
    setData(d=>({ ...d, [key]: arr }));
    setDirty(true); setMsg(null);
  }

  async function save(){
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/options',{ method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
      if(!res.ok) throw new Error(await res.text());
      const j = await res.json();
      // Nach dem Speichern nochmal Distincts holen, damit neue DB-Werte sofort wieder auftauchen
      try {
        const distRes = await fetch('/api/students/distincts',{cache:'no-store'});
        const dist = distRes.ok ? await distRes.json() : {};
        function union(a: string[], b: string[]){ const s = new Set<string>(); [...a,...b].forEach(x=>{ const t=(x||'').trim(); if(t) s.add(t); }); return Array.from(s); }
        const lists: Lists = {
          angebote: j.angebote||[],
          schwerpunkte: j.schwerpunkte||[],
          fruehbetreuung: j.fruehbetreuung||[],
            status: union(j.status||[], dist.status||[]).sort((a,b)=>a.localeCompare(b,'de')),
            religionen: union(j.religionen||[], dist.religionen||[]).sort((a,b)=>a.localeCompare(b,'de')),
            klassen: union(j.klassen||[], dist.klassen||[]).sort((a,b)=>a.localeCompare(b,'de')),
            sprachen: union(j.sprachen||[], dist.sprachen||[]).sort((a,b)=>a.localeCompare(b,'de'))
        };
        setData(lists);
        setRaw({
          angebote: lists.angebote.join('\n'),
          schwerpunkte: lists.schwerpunkte.join('\n'),
          fruehbetreuung: lists.fruehbetreuung.join('\n'),
          status: lists.status.join('\n'),
          religionen: lists.religionen.join('\n'),
          klassen: lists.klassen.join('\n'),
          sprachen: lists.sprachen.join('\n')
        });
      } catch {
        // Fallback: nur gespeicherten Zustand anzeigen
        const lists: Lists = { angebote:j.angebote||[], schwerpunkte:j.schwerpunkte||[], fruehbetreuung:j.fruehbetreuung||[], status:j.status||[], religionen:j.religionen||[], klassen:j.klassen||[], sprachen:j.sprachen||[] };
        setData(lists);
        setRaw({ angebote: lists.angebote.join('\n'), schwerpunkte: lists.schwerpunkte.join('\n'), fruehbetreuung: lists.fruehbetreuung.join('\n'), status: lists.status.join('\n'), religionen: lists.religionen.join('\n'), klassen: lists.klassen.join('\n'), sprachen: lists.sprachen.join('\n') });
      }
      setDirty(false); setMsg('Gespeichert');
    } catch(e){ setMsg('Fehler: '+((e as Error).message||'')); }
    finally { setSaving(false); }
  }

  return (
  <div className="w-full max-w-3xl mx-auto p-6 pt-10 space-y-6">
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
