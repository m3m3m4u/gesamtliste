"use client";
import React from 'react';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="text-center space-y-8 max-w-md">
        <h1 className="text-3xl font-bold tracking-tight">Willkommen</h1>
        <p className="text-gray-600 leading-relaxed">Nutze den Button, um Schüler zu suchen und Daten zu bearbeiten.</p>
  <div className="flex flex-col gap-4">
          <a
            href="/schueler"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md shadow transition-colors"
          >Suchen und bearbeiten</a>
          <a
            href="/klassenliste"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-md shadow transition-colors"
          >Klassenliste</a>
          <a
            href="/angebote"
            className="inline-block bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-md shadow transition-colors"
          >Angebote</a>
          <a
            href="/schwerpunkte"
            className="inline-block bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-md shadow transition-colors"
          >Schwerpunkte</a>
          <a
            href="/statistik"
            className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-3 rounded-md shadow transition-colors"
          >Statistik</a>
          <a
            href="/listen"
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-md shadow transition-colors"
          >Listen (Filter)</a>
          <button
            onClick={async () => {
              try {
                await fetch('/api/logout', { method: 'POST' });
              } catch {}
              window.location.href = '/login';
            }}
            className="inline-block bg-gray-200 hover:bg-gray-300 text-gray-800 px-8 py-3 rounded-md shadow transition-colors"
          >Ausloggen</button>
        </div>
      </div>
    </main>
  );
}
