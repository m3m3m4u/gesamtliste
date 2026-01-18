"use client";
import React, { useState, useEffect } from 'react';
import BackLink from '../statistik/BackLink';
import { SchuljahresWechsler } from '@/lib/schuljahr';

const ADMIN_CODE = '872020';
const STORAGE_KEY = 'admin_authenticated';

export default function AdministrationPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  // Prüfen ob bereits authentifiziert (Session Storage)
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setAuthenticated(true);
    }
    setChecking(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ADMIN_CODE) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setAuthenticated(true);
      setError('');
    } else {
      setError('Falscher Code');
    }
  };

  if (checking) {
    return (
      <div className="p-6 w-full max-w-md">
        <p className="text-gray-500">Laden...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <BackLink />
        </div>
        <h1 className="text-2xl font-bold mb-6">Administration</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Zugangscode eingeben</label>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              placeholder="Code"
              autoFocus
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow"
          >
            Anmelden
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 w-full max-w-md">
      <div className="flex items-center justify-between mb-4">
        <BackLink />
        <SchuljahresWechsler />
      </div>
      <h1 className="text-2xl font-bold mb-6">Administration</h1>
      <div className="flex flex-col gap-4">
        <a href="/uebersicht" className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-md shadow transition-colors text-center">Übersicht</a>
        <a href="/frage?next=%2Fschueler" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md shadow transition-colors text-center">Suchen & Bearbeiten</a>
        <a href="/frage?next=%2Foptionen" className="inline-block bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-8 py-3 rounded-md shadow transition-colors text-center">Optionen</a>
        <a href="/frage?next=%2Fmeldungen" className="inline-block bg-slate-600 hover:bg-slate-700 text-white px-8 py-3 rounded-md shadow transition-colors text-center">Eingegangene Meldungen</a>
      </div>
    </div>
  );
}
