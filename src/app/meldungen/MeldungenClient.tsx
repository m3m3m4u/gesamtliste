"use client";
import React, { useState } from 'react';

interface Report { _id: string; text: string; status: 'offen'|'erledigt'; createdAt: string; updatedAt: string; }

export default function MeldungenClient({ initialItems }: { initialItems: Report[] }) {
  const [items,setItems] = useState<Report[]>(initialItems);
  const [filter,setFilter] = useState<'alle'|'offen'|'erledigt'>('alle');
  const shown = items.filter(i=> filter==='alle' ? true : i.status===filter);

  async function update(id: string, status: 'offen'|'erledigt'){
    const res = await fetch('/api/reports/'+id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status }) });
    if(res.ok){
      setItems(prev=> prev.map(p=> p._id===id ? { ...p, status, updatedAt: new Date().toISOString() } : p));
    }
  }
  async function remove(id: string){
    if(!confirm('Löschen?')) return;
    const res = await fetch('/api/reports/'+id,{ method:'DELETE' });
    if(res.ok){ setItems(prev=> prev.filter(p=>p._id!==id)); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center text-sm">
        <div className="flex gap-2">
          {(['alle','offen','erledigt'] as const).map(f=> (
            <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1 rounded border text-xs ${filter===f? 'bg-slate-600 text-white':'bg-white hover:bg-gray-50'}`}>{f}</button>
          ))}
        </div>
        <div className="text-xs text-gray-500">{shown.length} / {items.length} Meldungen</div>
      </div>
      <div className="border rounded bg-white divide-y">
        {shown.map(r=> (
          <div key={r._id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <div className="whitespace-pre-wrap text-sm">{r.text}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-1">{r.createdAt?.slice(0,19).replace('T',' ')}{r.status==='erledigt' && ' · erledigt'}</div>
            </div>
            <div className="flex gap-2 text-xs">
              {r.status==='offen' ? (
                <button onClick={()=>update(r._id,'erledigt')} className="px-3 py-1 rounded bg-emerald-600 text-white">Erledigt</button>
              ) : (
                <button onClick={()=>update(r._id,'offen')} className="px-3 py-1 rounded bg-amber-600 text-white">Offen</button>
              )}
              <button onClick={()=>remove(r._id)} className="px-3 py-1 rounded bg-rose-600 text-white">Löschen</button>
            </div>
          </div>
        ))}
        {shown.length===0 && <div className="p-4 text-xs text-gray-500">Keine Meldungen.</div>}
      </div>
    </div>
  );
}