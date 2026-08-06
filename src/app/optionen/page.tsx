"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SchuljahresWechsler, useSchuljahr } from '@/lib/schuljahr';

type Lists = {
  angebote: string[]; schwerpunkte: string[]; fruehbetreuung: string[];
  status: string[]; religionen: string[]; klassen: string[]; sprachen: string[];
  angebote_2526: string[]; angebote_2627: string[];
  schwerpunkte_2526: string[]; schwerpunkte_2627: string[];
  fruehbetreuung_2526: string[]; fruehbetreuung_2627: string[];
};
type CountMap = Record<string, number>;

function sortDe(a: string, b: string){ return a.localeCompare(b, 'de', { sensitivity: 'base' }); }

function weekdayIndexLabel(s: string): { idx: number; rest: string } {
  const v = (s||'').trim().toLowerCase();
  const m = v.match(/^([^\s,;:]+)([\s,;:]+)?(.*)$/);
  const head = m ? m[1] : v;
  const tail = m ? (m[3] || '').trim() : '';
  const map: Record<string, number> = { mo:0, montag:0, di:1, dienstag:1, mi:2, mittwoch:2, do:3, donnerstag:3, fr:4, freitag:4, sa:5, samstag:5, so:6, sonntag:6 };
  for (const [k, idx] of Object.entries(map)) {
    if (head === k || head.startsWith(k)) return { idx, rest: tail };
  }
  return { idx: -1, rest: v };
}
function cmpFrueh(a: string, b: string): number {
  const A = weekdayIndexLabel(a); const B = weekdayIndexLabel(b);
  if (A.idx >= 0 && B.idx >= 0) { if (A.idx !== B.idx) return A.idx - B.idx; return sortDe(A.rest, B.rest); }
  if (A.idx >= 0) return -1; if (B.idx >= 0) return 1;
  return sortDe(a, b);
}
function sortList(cat: string, arr: string[]): string[] {
  const list = [...arr];
  if (cat === 'fruehbetreuung' || cat === 'fruehbetreuung_2526' || cat === 'fruehbetreuung_2627') return list.sort(cmpFrueh);
  return list.sort(sortDe);
}
function uniqueNorm(arr: string[]): string[] {
  const s = new Set<string>();
  for (const v of arr) { const t = (v||'').trim(); if (t) s.add(t); }
  return Array.from(s);
}

// Mapping: Schuljahr → interne Feldschlüssel
function getJahresKeys(schuljahr: string) {
  const sjKey = schuljahr.replace('/', ''); // '2526' oder '2627'
  return {
    angeboteKey: `angebote_${sjKey}` as keyof Lists,
    schwerpunkteKey: `schwerpunkte_${sjKey}` as keyof Lists,
    fruehKey: `fruehbetreuung_${sjKey}` as keyof Lists,
  };
}

export default function OptionenPage(){
  const { schuljahr } = useSchuljahr();
  const { angeboteKey, schwerpunkteKey, fruehKey } = useMemo(() => getJahresKeys(schuljahr), [schuljahr]);

  const [data, setData] = useState<Lists>({
    angebote:[], schwerpunkte:[], fruehbetreuung:[],
    status:[], religionen:[], klassen:[], sprachen:[],
    angebote_2526:[], angebote_2627:[],
    schwerpunkte_2526:[], schwerpunkte_2627:[],
    fruehbetreuung_2526:[], fruehbetreuung_2627:[],
  });
  const [counts, setCounts] = useState<{[K in keyof Lists]: CountMap}>({
    angebote:{}, schwerpunkte:{}, fruehbetreuung:{}, status:{}, religionen:{}, klassen:{}, sprachen:{},
    angebote_2526:{}, angebote_2627:{}, schwerpunkte_2526:{}, schwerpunkte_2627:{}, fruehbetreuung_2526:{}, fruehbetreuung_2627:{}
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  useEffect(()=>{ (async()=>{
    try {
      const [optRes, cntRes] = await Promise.all([
        fetch('/api/options',{cache:'no-store'}),
        fetch('/api/students/option-counts',{cache:'no-store'})
      ]);
      const opt = optRes.ok ? await optRes.json() : {};
      const cnt = cntRes.ok ? await cntRes.json() : {};
      const base: Lists = {
        angebote: Array.isArray(opt.angebote)? opt.angebote : [],
        schwerpunkte: Array.isArray(opt.schwerpunkte)? opt.schwerpunkte : [],
        fruehbetreuung: Array.isArray(opt.fruehbetreuung)? opt.fruehbetreuung : [],
        status: Array.isArray(opt.status)? opt.status : [],
        religionen: Array.isArray(opt.religionen)? opt.religionen : [],
        klassen: Array.isArray(opt.klassen)? opt.klassen : [],
        sprachen: Array.isArray(opt.sprachen)? opt.sprachen : [],
        angebote_2526: Array.isArray(opt.angebote_2526)? opt.angebote_2526 : [],
        angebote_2627: Array.isArray(opt.angebote_2627)? opt.angebote_2627 : [],
        schwerpunkte_2526: Array.isArray(opt.schwerpunkte_2526)? opt.schwerpunkte_2526 : [],
        schwerpunkte_2627: Array.isArray(opt.schwerpunkte_2627)? opt.schwerpunkte_2627 : [],
        fruehbetreuung_2526: Array.isArray(opt.fruehbetreuung_2526)? opt.fruehbetreuung_2526 : [],
        fruehbetreuung_2627: Array.isArray(opt.fruehbetreuung_2627)? opt.fruehbetreuung_2627 : [],
      };
      (Object.keys(base) as (keyof Lists)[]).forEach(k=>{ base[k] = sortList(k, uniqueNorm(base[k])); });
      setData(base);
      setCounts({
        angebote: cnt.angebote||{}, schwerpunkte: cnt.schwerpunkte||{}, fruehbetreuung: cnt.fruehbetreuung||{},
        status: cnt.status||{}, religionen: cnt.religionen||{}, klassen: cnt.klassen||{}, sprachen: cnt.sprachen||{},
        angebote_2526: cnt.angebote_2526||cnt.angebote||{}, angebote_2627: cnt.angebote_2627||{},
        schwerpunkte_2526: cnt.schwerpunkte_2526||cnt.schwerpunkte||{}, schwerpunkte_2627: cnt.schwerpunkte_2627||{},
        fruehbetreuung_2526: cnt.fruehbetreuung_2526||cnt.fruehbetreuung||{}, fruehbetreuung_2627: cnt.fruehbetreuung_2627||{},
      });
    } catch {}
  })(); },[]);

  async function refreshCounts(){
    try {
      const r = await fetch('/api/students/option-counts',{cache:'no-store'});
      if(r.ok){
        const j = await r.json();
        setCounts({
          angebote: j.angebote||{}, schwerpunkte: j.schwerpunkte||{}, fruehbetreuung: j.fruehbetreuung||{},
          status: j.status||{}, religionen: j.religionen||{}, klassen: j.klassen||{}, sprachen: j.sprachen||{},
          angebote_2526: j.angebote_2526||j.angebote||{}, angebote_2627: j.angebote_2627||{},
          schwerpunkte_2526: j.schwerpunkte_2526||j.schwerpunkte||{}, schwerpunkte_2627: j.schwerpunkte_2627||{},
          fruehbetreuung_2526: j.fruehbetreuung_2526||j.fruehbetreuung||{}, fruehbetreuung_2627: j.fruehbetreuung_2627||{},
        });
      }
    } catch {}
  }

  function addItem(cat: keyof Lists, value: string){
    const v = value.trim(); if(!v) return; setMsg(null);
    setData(prev=>{
      const arr = sortList(cat, uniqueNorm([...(prev[cat]||[]), v]));
      return { ...prev, [cat]: arr } as Lists;
    });
    setDirty(true);
  }
  async function renameItem(cat: keyof Lists, oldVal: string, newVal: string){
    const n = newVal.trim(); if(!n || n===oldVal) return;
    setMsg(null);
    const currentCount = counts[cat]?.[oldVal] ?? 0;
    const doMigrate = window.confirm(`"${oldVal}" → "${n}"${currentCount>0 ? `\n\nAuch bei ${currentCount} Schüler(n) umbenennen?` : '\n\nAuch in Schülerdaten umbenennen?'}\n(Abbrechen = nur in der Liste ändern)`);
    if (doMigrate) {
      try {
        const res = await fetch('/api/options/migrate', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ category: cat, oldValue: oldVal, newValue: n }) });
        if (!res.ok) throw new Error(await res.text());
        setData(prev=>{
          const arr = (prev[cat]||[]).filter(x=>x!==oldVal);
          if(!arr.includes(n)) arr.push(n);
          return { ...prev, [cat]: sortList(cat, arr) } as Lists;
        });
        await refreshCounts();
        setMsg('Umbenannt und migriert');
        setDirty(false);
        return;
      } catch(e){ setMsg('Fehler bei Migration: '+((e as Error).message||'')); }
    }
    setData(prev=>{
      const arr = (prev[cat]||[]).filter(x=>x!==oldVal);
      if(!arr.includes(n)) arr.push(n);
      return { ...prev, [cat]: sortList(cat, arr) } as Lists;
    });
    setDirty(true);
  }
  function deleteItem(cat: keyof Lists, value: string){
    setData(prev=>{ const arr = (prev[cat]||[]).filter(x=>x!==value); return { ...prev, [cat]: arr } as Lists; });
    setDirty(true); setMsg(null);
  }

  async function save(){
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/options',{ method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
      if(!res.ok) throw new Error(await res.text());
      const j = await res.json();
      const lists: Lists = {
        angebote: j.angebote||[], schwerpunkte: j.schwerpunkte||[], fruehbetreuung: j.fruehbetreuung||[],
        status: j.status||[], religionen: j.religionen||[], klassen: j.klassen||[], sprachen: j.sprachen||[],
        angebote_2526: j.angebote_2526||[], angebote_2627: j.angebote_2627||[],
        schwerpunkte_2526: j.schwerpunkte_2526||[], schwerpunkte_2627: j.schwerpunkte_2627||[],
        fruehbetreuung_2526: j.fruehbetreuung_2526||[], fruehbetreuung_2627: j.fruehbetreuung_2627||[],
      };
      (Object.keys(lists) as (keyof Lists)[]).forEach(k=>{ lists[k] = sortList(k, uniqueNorm(lists[k])); });
      setData(lists);
      setDirty(false); setMsg('Gespeichert');
      await refreshCounts();
    } catch(e){ setMsg('Fehler: '+((e as Error).message||'')); }
    finally { setSaving(false); }
  }

  function discard(){
    setDirty(false); setMsg('Verworfen');
    (async()=>{
      try {
        const r = await fetch('/api/options',{cache:'no-store'});
        if(r.ok){
          const j = await r.json();
          const lists: Lists = {
            angebote:j.angebote||[], schwerpunkte:j.schwerpunkte||[], fruehbetreuung:j.fruehbetreuung||[],
            status:j.status||[], religionen:j.religionen||[], klassen:j.klassen||[], sprachen:j.sprachen||[],
            angebote_2526:j.angebote_2526||[], angebote_2627:j.angebote_2627||[],
            schwerpunkte_2526:j.schwerpunkte_2526||[], schwerpunkte_2627:j.schwerpunkte_2627||[],
            fruehbetreuung_2526:j.fruehbetreuung_2526||[], fruehbetreuung_2627:j.fruehbetreuung_2627||[],
          };
          (Object.keys(lists) as (keyof Lists)[]).forEach(k=>{ lists[k] = sortList(k, uniqueNorm(lists[k])); });
          setData(lists);
        }
      } catch{}
    })();
  }

  // Jahresspezifische Kategorien je nach aktivem Schuljahr
  const jahresCategories = useMemo(() => [
    { key: schwerpunkteKey, title: `Schwerpunkte ${schuljahr}` },
    { key: fruehKey,        title: `Frühbetreuung ${schuljahr}` },
    { key: angeboteKey,     title: `Angebote ${schuljahr}` },
  ], [schuljahr, angeboteKey, schwerpunkteKey, fruehKey]);

  // Schuljahr-unabhängige Kategorien
  const globalCategories: { key: keyof Lists; title: string }[] = [
    { key:'status', title:'Status' },
    { key:'religionen', title:'Religionen' },
    { key:'klassen', title:'Klassen' },
    { key:'sprachen', title:'Sprachen (Muttersprache)' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto p-6 pt-10 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Optionen verwalten</h1>
        <div className="flex items-center gap-2">
          <SchuljahresWechsler />
          <button disabled={!dirty||saving} onClick={save} className="px-3 py-1.5 rounded bg-green-600 text-white text-sm disabled:opacity-50">{saving? '...' : 'Speichern'}</button>
          <button disabled={!dirty||saving} onClick={discard} className="px-3 py-1.5 rounded border text-sm">Verwerfen</button>
          <Link href="/" className="text-sm text-blue-600 underline ml-2">Zurück</Link>
        </div>
      </div>
      <p className="text-sm text-gray-600">Feste Einträge pro Kategorie und Schuljahr. Umbenennen/Löschen über Aktionen. Zähler berücksichtigen nur aktive Schüler (ohne Papierkorb).</p>

      {/* Jahresspezifische Listen */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Schuljahr 20{schuljahr}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          {jahresCategories.map(cat=>(
            <CategoryCard
              key={cat.key}
              title={cat.title}
              items={(data[cat.key as keyof Lists]||[])}
              counts={counts[cat.key as keyof Lists]||{}}
              onAdd={(v)=>addItem(cat.key as keyof Lists, v)}
              onRename={(oldV,newV)=>renameItem(cat.key as keyof Lists, oldV, newV)}
              onDelete={(v)=>{
                const n = counts[cat.key as keyof Lists]?.[v] ?? 0;
                const ok = window.confirm(n>0 ? `"${v}" ist ${n} Schüler(n) zugeordnet. Löschen entfernt nur aus der Optionen-Liste. Fortfahren?` : `"${v}" löschen?`);
                if(ok) deleteItem(cat.key as keyof Lists, v);
              }}
            />
          ))}
        </div>
      </div>

      {/* Schuljahr-unabhängige Listen */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Allgemein (schuljahrunabhängig)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          {globalCategories.map(cat=>(
            <CategoryCard
              key={cat.key}
              title={cat.title}
              items={(data[cat.key]||[])}
              counts={counts[cat.key]||{}}
              onAdd={(v)=>addItem(cat.key, v)}
              onRename={(oldV,newV)=>renameItem(cat.key, oldV, newV)}
              onDelete={(v)=>{
                const n = counts[cat.key]?.[v] ?? 0;
                const ok = window.confirm(n>0 ? `"${v}" ist ${n} Schüler(n) zugeordnet. Löschen entfernt nur aus der Optionen-Liste. Fortfahren?` : `"${v}" löschen?`);
                if(ok) deleteItem(cat.key, v);
              }}
            />
          ))}
        </div>
      </div>

      {msg && <div className="text-xs text-gray-700">{msg}</div>}
    </div>
  );
}

function CategoryCard({ title, items, counts, onAdd, onRename, onDelete }:{
  title: string;
  items: string[];
  counts: CountMap;
  onAdd: (value: string)=>void;
  onRename: (oldVal: string, newVal: string)=>void;
  onDelete: (value: string)=>void;
}){
  const [adding, setAdding] = useState('');
  const [editKey, setEditKey] = useState<string|null>(null);
  const [editVal, setEditVal] = useState('');
  function commitEdit(oldVal: string){ onRename(oldVal, editVal); setEditKey(null); setEditVal(''); }
  return (
    <div className="border rounded p-3 bg-white">
      <div className="font-semibold mb-2">{title}</div>
      <div className="flex flex-col gap-2 mb-3">
        {items.length===0 && <div className="text-xs text-gray-400">(keine Einträge)</div>}
        {items.map(val=>{
          const c = counts[val] ?? 0;
          const editing = editKey === val;
          return (
            <div key={val} className="flex items-center justify-between border rounded px-2 py-1">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {editing ? (
                  <>
                    <input autoFocus className="border rounded px-2 py-1 text-xs w-full" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') commitEdit(val); if(e.key==='Escape'){ setEditKey(null); setEditVal(''); } }} />
                  </>
                ) : (
                  <button type="button" className="text-xs text-left hover:underline truncate" onClick={()=>{ setEditKey(val); setEditVal(val); }} title="Umbenennen">{val}</button>
                )}
              </div>
              <div className="flex items-center gap-2 pl-2">
                {editing ? (
                  <>
                    <button type="button" className="text-xs px-2 py-0.5 bg-green-600 text-white rounded" onClick={()=>commitEdit(val)} title="Bestätigen">✓</button>
                    <button type="button" className="text-xs px-2 py-0.5 border rounded" onClick={()=>{ setEditKey(null); setEditVal(''); }} title="Abbrechen">✕</button>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 border text-gray-700 select-none">{c}</span>
                    <button type="button" className="text-xs px-1 leading-none text-gray-600 hover:text-rose-700" onClick={()=>onDelete(val)} title="Eintrag löschen">x</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input className="border rounded px-2 py-1 text-xs flex-1" placeholder="Neuer Eintrag" value={adding} onChange={e=>setAdding(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ onAdd(adding); setAdding(''); } }} />
        <button className="text-xs px-2 py-1 bg-blue-600 text-white rounded" onClick={()=>{ onAdd(adding); setAdding(''); }}>Hinzufügen</button>
      </div>
    </div>
  );
}
