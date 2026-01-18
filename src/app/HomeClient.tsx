"use client";
import React from 'react';
import { SchuljahresWechsler, useSchuljahr } from '@/lib/schuljahr';

export default function HomeClient() {
  const { schuljahrLabel } = useSchuljahr();
  
  return (
    <main className="w-full flex justify-center p-8">
      <div className="text-center space-y-8 max-w-md mt-8">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Hauptmenü</h1>
          <SchuljahresWechsler />
        </div>
        <p className="text-gray-600 leading-relaxed">Wähle einen Bereich. (Schuljahr {schuljahrLabel})</p>
        <div className="flex flex-col gap-4">
          <a href="/klassenliste" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-md shadow transition-colors">Klassenliste</a>
          <a href="/angebote" className="inline-block bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-md shadow transition-colors">Angebote</a>
          <a href="/fruehbetreuung" className="inline-block bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-3 rounded-md shadow transition-colors">Frühbetreuung</a>
          <a href="/schwerpunkte" className="inline-block bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-md shadow transition-colors">Schwerpunkte</a>
          <a href="/deckblaetter" className="inline-block bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-md shadow transition-colors">Deckblätter</a>
          <a href="/listen" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-md shadow transition-colors">Listen (Filter)</a>
          <a href="/fehler" className="inline-block bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-md shadow transition-colors">Fehler melden</a>
          <a href="/administration" className="inline-block bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-md shadow transition-colors">Administration</a>
        </div>
      </div>
    </main>
  );
}
