"use client";
import React from 'react';
import { SchuljahresWechsler, useSchuljahr } from '@/lib/schuljahr';

export default function UebersichtPage() {
  const { schuljahrLabel } = useSchuljahr();
  
  return (
    <main className="w-full flex justify-center p-8">
      <div className="text-center space-y-8 max-w-md mt-8">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Übersicht</h1>
          <SchuljahresWechsler />
        </div>
        <p className="text-gray-600 leading-relaxed">Wähle eine Stufengruppe. (Schuljahr {schuljahrLabel})</p>
        <div className="flex flex-col gap-4">
          <a 
            href="/uebersicht/stufen123" 
            className="inline-block bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-md shadow transition-colors"
          >
            Stufen 1, 2, 3
          </a>
          <a 
            href="/uebersicht/stufen456" 
            className="inline-block bg-lime-600 hover:bg-lime-700 text-white px-8 py-3 rounded-md shadow transition-colors"
          >
            Stufen 4, 5, 6
          </a>
          <a 
            href="/uebersicht/stufen78" 
            className="inline-block bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-md shadow transition-colors"
          >
            Stufen 7, 8
          </a>
        </div>
        <div className="pt-4">
          <a href="/" className="text-gray-500 hover:text-gray-700 text-sm">← Zurück zum Hauptmenü</a>
        </div>
      </div>
    </main>
  );
}
