"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginClient({ nextPath }: { nextPath: string }) {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      if (!res.ok) throw new Error(await res.text());
      router.push(nextPath || '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 p-4">
      <div className="w-full max-w-sm mt-6">
        <form onSubmit={submit} className="bg-white border rounded p-6 space-y-4 shadow-sm">
          <h1 className="text-xl font-semibold">Anmelden</h1>
          <label className="block text-sm">
            <span className="text-gray-700">Passwort</span>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" placeholder="Passwort" autoFocus />
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button disabled={!pw || loading} className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50">{loading ? '…' : 'Einloggen'}</button>
          <p className="text-[10px] text-gray-400 leading-snug">Einbettung: ?auth=872020 an URL anhängen falls Cookie blockiert.</p>
        </form>
      </div>
    </div>
  );
}
