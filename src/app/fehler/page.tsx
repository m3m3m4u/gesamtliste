"use client";
import React, { useState } from 'react';
import Link from 'next/link';

export default function FehlerMeldenPage(){
  const [text,setText] = useState('');
  const [sending,setSending] = useState(false);
  const [msg,setMsg] = useState<string|null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setSending(true); setMsg(null);
    try {
      const res = await fetch('/api/reports',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
      if(!res.ok) throw new Error(await res.text());
      setMsg('Gesendet – danke!'); setText('');
  } catch{ setMsg('Fehler beim Senden'); }
    finally { setSending(false); }
  }
  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Fehler melden</h1>
  <Link href="/" className="text-sm text-blue-600 underline">Zurück</Link>
      </div>
      <p className="text-sm text-gray-600">Beschreibe kurz, was nicht funktioniert oder verbessert werden sollte.</p>
      <form onSubmit={submit} className="space-y-4">
        <textarea value={text} onChange={e=>setText(e.target.value)} className="w-full min-h-[160px] border rounded px-3 py-2 text-sm" placeholder="Beschreibung..." required />
        {msg && <div className="text-xs text-gray-700">{msg}</div>}
        <div className="flex gap-3">
          <button disabled={!text.trim()||sending} className="px-4 py-2 rounded bg-orange-600 text-white text-sm disabled:opacity-50">{sending? '...' : 'Absenden'}</button>
          <button type="button" disabled={!text||sending} onClick={()=>{setText('');}} className="px-4 py-2 rounded border text-sm disabled:opacity-50">Leeren</button>
        </div>
      </form>
    </div>
  );
}