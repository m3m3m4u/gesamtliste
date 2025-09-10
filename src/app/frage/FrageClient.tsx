"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function FrageClient({ nextPath }: { nextPath: string }) {
  const [val, setVal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function normalizeTarget(raw: string): string {
    if (!raw) return '/';
    try { raw = decodeURIComponent(raw); } catch {}
    // Erlaube auch Formate ohne führenden Slash
    if (!raw.startsWith('/')) raw = '/' + raw.replace(/^\/+/, '');
    // Whitelist einfacher Bereiche
    const allowed = ['/','/schueler','/optionen','/meldungen','/klassenliste','/angebote','/schwerpunkte','/listen','/fehler'];
    if (!allowed.includes(raw)) return '/';
    return raw;
  }

  const target = normalizeTarget(nextPath);

  function submit(e: React.FormEvent){
    e.preventDefault();
    if (val.trim() === '872020') {
      // Erst Soft-Navigation, dann harter Fallback
      try { router.push(target); } catch {}
      setTimeout(() => {
        if (window.location.pathname !== target) {
          window.location.assign(target);
        }
      }, 150);
    } else {
      setError('Falsch – nochmal versuchen.');
    }
  }
  return (
    <div className="min-h-screen flex items-start justify-center p-6 bg-gray-50 w-full">
      <form onSubmit={submit} className="mt-24 bg-white border rounded shadow-sm p-6 w-full max-w-sm space-y-4">
        <h1 className="text-lg font-semibold">Kurze Frage</h1>
        <p className="text-sm text-gray-600">Bitte gib den bekannten Code ein.</p>
        <input type="password" value={val} onChange={e=>{ setVal(e.target.value); setError(null); }} className="w-full border rounded px-3 py-2" placeholder="Code" autoFocus />
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button disabled={!val} className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-40">Weiter</button>
        <p className="text-[10px] text-gray-400 leading-snug">Hinweis: Das ist kein echtes Login, nur eine einfache Abfrage.</p>
      </form>
    </div>
  );
}
