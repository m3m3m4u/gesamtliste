"use client";
import React, { useEffect, useState, useCallback } from 'react';
import BackLink from '../statistik/BackLink';
import { SchuljahresWechsler, useSchuljahr } from '@/lib/schuljahr';

interface Option { value: string; label: string; }
interface Student { _id: string; Vorname?: string; Familienname?: string; }

export default function DeckblaetterPage() {
  const { schuljahr } = useSchuljahr();
  const [klasse, setKlasse] = useState('');
  const [availableKlassen, setAvailableKlassen] = useState<Option[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Klassen-Liste aus DB laden (einmal)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/students/distincts?schuljahr=${encodeURIComponent(schuljahr)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const arr = Array.isArray(json.klassen)
          ? json.klassen.map((v: string) => v.trim()).filter((v: string) => v.length > 0)
          : [];
        const opts: Option[] = (arr as string[])
          .sort((a: string, b: string) => a.localeCompare(b, 'de'))
          .map((v: string) => ({ value: v, label: v }));
        setAvailableKlassen(opts);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [schuljahr]);

  // Schüler für ausgewählte Klasse laden
  const loadStudents = useCallback(async () => {
    if (!klasse) {
      setStudents([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        klasse,
        schuljahr,
        fields: 'Vorname,Familienname',
        limit: '500'
      });
      const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const json: { items?: Student[] } = await res.json();
      // Nach Familienname, dann Vorname sortieren
      const sorted = (json.items || []).sort((a, b) => {
        const famA = (a.Familienname || '').toLowerCase();
        const famB = (b.Familienname || '').toLowerCase();
        if (famA !== famB) return famA.localeCompare(famB, 'de');
        const vorA = (a.Vorname || '').toLowerCase();
        const vorB = (b.Vorname || '').toLowerCase();
        return vorA.localeCompare(vorB, 'de');
      });
      setStudents(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [klasse, schuljahr]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  return (
    <div className="p-6 w-full max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <BackLink />
        <SchuljahresWechsler />
      </div>
      <h1 className="text-2xl font-bold mb-4">Deckblätter</h1>

      {/* Klassen-Auswahl */}
      <div className="mb-6">
        <label className="block text-sm text-gray-600 mb-1">Klasse auswählen</label>
        <select
          value={klasse}
          onChange={(e) => setKlasse(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-xs"
        >
          <option value="">-- Klasse wählen --</option>
          {availableKlassen.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Ergebnisse */}
      {loading && <p className="text-gray-500">Laden...</p>}
      {error && <p className="text-red-600">{error}</p>}
      
      {!loading && !error && klasse && students.length === 0 && (
        <p className="text-gray-500">Keine Schüler in dieser Klasse gefunden.</p>
      )}

      {!loading && students.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">
              {students.length} Schüler in Klasse {klasse}
            </p>
            <div className="flex gap-2">
              <a
                href={`/api/deckblatt-zip?klasse=${encodeURIComponent(klasse)}&schuljahr=${encodeURIComponent(schuljahr)}`}
                download
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                ZIP (einzelne Dateien)
              </a>
              <a
                href={`/api/deckblatt-combined?klasse=${encodeURIComponent(klasse)}&schuljahr=${encodeURIComponent(schuljahr)}`}
                download
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                Word (alle in einer Datei)
              </a>
            </div>
          </div>
          <ul className="space-y-1">
            {students.map((s) => (
              <li key={s._id} className="text-lg flex items-center gap-2">
                <a
                  href={`/api/deckblatt?id=${s._id}`}
                  download
                  className="text-blue-600 hover:text-blue-800"
                  title="Deckblatt herunterladen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </a>
                <span>{s.Vorname} {s.Familienname}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
