"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Verfügbare Schuljahre
export const SCHULJAHRE = ['25/26', '26/27'] as const;
export type Schuljahr = typeof SCHULJAHRE[number];

// Standard-Schuljahr
export const DEFAULT_SCHULJAHR: Schuljahr = '25/26';

interface SchuljahresContextType {
  schuljahr: Schuljahr;
  setSchuljahr: (sj: Schuljahr) => void;
  // Dynamische Feldnamen
  stufeFeld: string;
  klasseFeld: string;
  besuchsjahrFeld: string;
  // Hilfsfunktion für Label
  schuljahrLabel: string;
}

const SchuljahresContext = createContext<SchuljahresContextType | undefined>(undefined);

export function SchuljahresProvider({ children }: { children: ReactNode }) {
  const [schuljahr, setSchuljahr] = useState<Schuljahr>(DEFAULT_SCHULJAHR);

  // Beim Laden aus localStorage wiederherstellen
  useEffect(() => {
    const saved = localStorage.getItem('schuljahr');
    if (saved && SCHULJAHRE.includes(saved as Schuljahr)) {
      setSchuljahr(saved as Schuljahr);
    }
  }, []);

  // Bei Änderung in localStorage speichern
  useEffect(() => {
    localStorage.setItem('schuljahr', schuljahr);
  }, [schuljahr]);

  const stufeFeld = `Stufe ${schuljahr}`;
  const klasseFeld = `Klasse ${schuljahr}`;
  // Besuchsjahr-Feld: für 25/26 heißt es "Besuchsjahr", für andere Jahre "Besuchsjahr XX/YY"
  const besuchsjahrFeld = schuljahr === '25/26' ? 'Besuchsjahr' : `Besuchsjahr ${schuljahr}`;
  const schuljahrLabel = `20${schuljahr}`;

  return (
    <SchuljahresContext.Provider value={{
      schuljahr,
      setSchuljahr,
      stufeFeld,
      klasseFeld,
      besuchsjahrFeld,
      schuljahrLabel,
    }}>
      {children}
    </SchuljahresContext.Provider>
  );
}

export function useSchuljahr() {
  const context = useContext(SchuljahresContext);
  if (!context) {
    throw new Error('useSchuljahr muss innerhalb von SchuljahresProvider verwendet werden');
  }
  return context;
}

// Komponente zum Umschalten des Schuljahres
export function SchuljahresWechsler({ className = '' }: { className?: string }) {
  const { schuljahr, setSchuljahr, schuljahrLabel } = useSchuljahr();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-xs font-medium text-gray-600">Schuljahr:</label>
      <select
        value={schuljahr}
        onChange={(e) => setSchuljahr(e.target.value as Schuljahr)}
        className="text-sm border rounded px-2 py-1 bg-white"
      >
        {SCHULJAHRE.map((sj) => (
          <option key={sj} value={sj}>
            20{sj}
          </option>
        ))}
      </select>
    </div>
  );
}
