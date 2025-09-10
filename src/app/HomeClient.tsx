"use client";
import React from 'react';

export default function HomeClient() {
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
          <a href="/frage?next=%2Fschueler" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md shadow transition-colors">Suchen & Bearbeiten</a>
          <a href="/frage?next=%2Foptionen" className="inline-block bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-8 py-3 rounded-md shadow transition-colors">Optionen</a>
          <a href="/fehler" className="inline-block bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-md shadow transition-colors">Fehler melden</a>
          <a href="/frage?next=%2Fmeldungen" className="inline-block bg-slate-600 hover:bg-slate-700 text-white px-8 py-3 rounded-md shadow transition-colors">Eingegangene Meldungen</a>
        </div>
      </div>
    </main>
  );
}
