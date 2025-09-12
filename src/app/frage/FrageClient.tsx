"use client";
import React, { useState } from 'react';

export default function FrageClient({ nextPath }: { nextPath: string }) {
  const [val, setVal] = useState('');
  const [error, setError] = useState<string | null>(null);

  function normalizeTarget(raw: string): string {
    if (!raw) return '/';
    try { raw = decodeURIComponent(raw); } catch {}
    if (!raw.startsWith('/')) raw = '/' + raw.replace(/^\/+/, '');
    // Erlaube jeden einfachen internen Pfad ohne Protokoll / Host / Query Manipulation
    // Sicherheit: Keine "//" am Anfang außer genau "/"; keine ":" oder ".." Segmente
    if (raw.startsWith('//') || raw.includes('://')) return '/';
    if (raw.split('/').some(seg => seg === '..')) return '/';
    return raw;
  }

  const target = normalizeTarget(nextPath);
  const protectedTargets = new Set<string>(['/schueler','/optionen','/meldungen']);
  const needsCode = protectedTargets.has(target);
  // Debug & optional sofortige Weiterleitung für ungeschützte Ziele
  if (typeof window !== 'undefined') {
    console.debug('[Frage] nextPath raw=', nextPath, 'normalized=', target, 'needsCode=', needsCode);
    if (!needsCode) {
      // Direkt weiter – kein Code erforderlich
      setTimeout(()=>{
        if (window.location.pathname.startsWith('/frage')) {
          try { window.location.replace(target); } catch { window.location.href = target; }
        }
      }, 20);
    } else {
      try {
        fetch(target, { method:'HEAD' })
          .then(r=>console.debug('[Frage] Vorab-Check', target, 'Status', r.status))
          .catch(err=>console.debug('[Frage] Vorab-Check Fehler', err));
      } catch(e) { console.debug('[Frage] Vorab-Check sync Fehler', e); }
    }
  }

  const [attempted, setAttempted] = useState(false);
  function submit(e: React.FormEvent){
    e.preventDefault();
    if (!needsCode) {
      // Sollte eigentlich schon umgeleitet haben; Fallback
      try { window.location.replace(target); } catch { window.location.href = target; }
      return;
    }
    if (val.trim() === '872020') {
      console.debug('[Frage] Code korrekt →', target);
      setAttempted(true);
      // Direkt harter Redirect (reduziert Timing-Probleme)
      try { window.location.replace(target); }
      catch (err){ console.warn('[Frage] replace fehlgeschlagen', err); window.location.href = target; }
      // Sicherheitsnetz: nach 800ms Link einblenden falls noch auf /frage
      setTimeout(()=>{
        if (window.location.pathname.startsWith('/frage')) {
          console.debug('[Frage] Bleibe auf /frage – zeige Notfall-Link');
        }
      }, 800);
    } else {
      setError('Falsch – nochmal versuchen.');
    }
  }
  return (
    <div className="min-h-screen flex items-start justify-center p-6 bg-gray-50 w-full">
      <form onSubmit={submit} className="mt-24 bg-white border rounded shadow-sm p-6 w-full max-w-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-lg font-semibold">Kurze Frage</h1>
          <button
            type="button"
            onClick={()=>{ try { if (window.history.length > 1) window.history.back(); else window.location.href = '/'; } catch { window.location.href = '/'; } }}
            className="text-xs text-gray-500 hover:text-gray-700 underline mt-1"
          >Zurück</button>
        </div>
        {needsCode ? (
          <p className="text-sm text-gray-600">Bitte gib den bekannten Code ein.</p>
        ) : (
          <p className="text-sm text-gray-600">Dieser Bereich benötigt keinen Code – Weiterleitung…</p>
        )}
        {needsCode && (
          <input type="password" value={val} onChange={e=>{ setVal(e.target.value); setError(null); }} className="w-full border rounded px-3 py-2" placeholder="Code" autoFocus />
        )}
  {error && <div className="text-xs text-red-600">{error}</div>}
  {attempted && needsCode && <div className="text-[11px] text-amber-700">Falls nichts passiert: <a className="underline" href={target}>Hier klicken</a></div>}
        {needsCode && <button disabled={!val} className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-40">Weiter</button>}
        {needsCode && <p className="text-[10px] text-gray-400 leading-snug">Hinweis: Das ist kein echtes Login, nur eine einfache Abfrage.</p>}
      </form>
    </div>
  );
}
