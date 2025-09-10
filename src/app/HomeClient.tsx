"use client";
import React from 'react';

export default function HomeClient({ serverAuthed }: { serverAuthed: boolean }) {
  const [authed, setAuthed] = React.useState(serverAuthed);
  React.useEffect(() => {
    if (!serverAuthed) {
      try {
        const ls = localStorage.getItem('site_auth_local');
        if (ls === '1') setAuthed(true);
      } catch {}
    }
  }, [serverAuthed]);
  return (
    <main className="w-full flex justify-center p-8">
      <div className="text-center space-y-8 max-w-md mt-8">
        <h1 className="text-3xl font-bold tracking-tight">Übersicht</h1>
        <p className="text-gray-600 leading-relaxed">Wähle einen Bereich.</p>
        <div className="flex flex-col gap-4">
          <a href="/klassenliste" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-md shadow transition-colors">Klassenliste</a>
          <a href="/angebote" className="inline-block bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-md shadow transition-colors">Angebote</a>
          <a href="/schwerpunkte" className="inline-block bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-md shadow transition-colors">Schwerpunkte</a>
          <a href="/listen" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-md shadow transition-colors">Listen (Filter)</a>
          <a href="/schueler" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md shadow transition-colors">Suchen & Bearbeiten (mit Passwort)</a>
          <a href="/optionen" className="inline-block bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-8 py-3 rounded-md shadow transition-colors">Optionen (mit Passwort)</a>
          <a href="/fehler" className="inline-block bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-md shadow transition-colors">Fehler melden</a>
          {authed ? (
            <a href="/meldungen" className="inline-block bg-slate-600 hover:bg-slate-700 text-white px-8 py-3 rounded-md shadow transition-colors">Eingegangene Meldungen</a>
          ) : (
            <a href="/meldungen" className="inline-block bg-slate-400 hover:bg-slate-500 text-white px-8 py-3 rounded-md shadow transition-colors" title="Mit Passwort zugänglich">Eingegangene Meldungen (mit Passwort)</a>
          )}
          {authed && (
            <form action="/api/logout" method="post">
              <button type="submit" className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-8 py-3 rounded-md shadow transition-colors">Abmelden</button>
            </form>
          )}
          {!authed && (
            <div className="text-[10px] text-gray-400 leading-snug">Einbettung: ?auth=872020 anhängen. Lokaler Fallback aktiv, falls Cookies blockiert.</div>
          )}
        </div>
      </div>
    </main>
  );
}
