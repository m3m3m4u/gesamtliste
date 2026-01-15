"use client";
import React, { useEffect, useState, useMemo } from 'react';
import type { StudentDoc } from '@/lib/mongodb';
import { useSchuljahr, SchuljahresWechsler } from '@/lib/schuljahr';

// Präfixe für Stufen 4, 5, 6
const KLASSEN_PREFIXES = ['A2', 'B1', 'C1'];

export default function Stufen456Page() {
  const { schuljahr, stufeFeld, klasseFeld, schuljahrLabel } = useSchuljahr();
  const [allKlassen, setAllKlassen] = useState<string[]>([]);
  const [studentsByKlasse, setStudentsByKlasse] = useState<Record<string, StudentDoc[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gefilterte Klassen nach Präfix
  const filteredKlassen = useMemo(() => {
    return allKlassen
      .filter(k => KLASSEN_PREFIXES.some(p => k.startsWith(p)))
      .sort((a, b) => a.localeCompare(b, 'de'));
  }, [allKlassen]);

  // Klassen laden
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/students/distincts?schuljahr=${schuljahr}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Fehler beim Laden der Klassen');
        const json = await res.json();
        const klassen = Array.isArray(json.klassen) 
          ? json.klassen.map((v: string) => v.trim()).filter((v: string) => v.length > 0) 
          : [];
        setAllKlassen(klassen);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Fehler');
      }
    })();
  }, [schuljahr]);

  // Schüler für jede gefilterte Klasse laden
  useEffect(() => {
    if (filteredKlassen.length === 0) {
      setLoading(false);
      return;
    }
    
    (async () => {
      setLoading(true);
      const results: Record<string, StudentDoc[]> = {};
      
      for (const klasse of filteredKlassen) {
        try {
          const params = new URLSearchParams({ 
            klasse, 
            limit: '500',
            fields: `Vorname,Familienname,Nachname,${stufeFeld},Geschlecht,Religion,Muttersprache,Besuchsjahr`,
            schuljahr
          });
          const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            results[klasse] = json.items || [];
          }
        } catch (e) {
          console.error(`Fehler beim Laden von ${klasse}:`, e);
        }
      }
      
      setStudentsByKlasse(results);
      setLoading(false);
    })();
  }, [filteredKlassen, stufeFeld, schuljahr]);

  const getName = (s: StudentDoc) => {
    const rec = s as Record<string, unknown>;
    const fam = rec['Familienname'] ?? rec['Nachname'] ?? '';
    return `${s.Vorname || ''} ${fam}`.trim();
  };

  const sortStudents = (a: StudentDoc, b: StudentDoc) => {
    const recA = a as Record<string, unknown>;
    const recB = b as Record<string, unknown>;
    
    // 1. Nach Stufe
    const stufeA = String(recA[stufeFeld] || '0');
    const stufeB = String(recB[stufeFeld] || '0');
    const stufeCmp = stufeA.localeCompare(stufeB, 'de', { numeric: true });
    if (stufeCmp !== 0) return stufeCmp;
    
    // 2. Nach Geschlecht
    const geschA = String(recA['Geschlecht'] || '');
    const geschB = String(recB['Geschlecht'] || '');
    const geschCmp = geschA.localeCompare(geschB, 'de');
    if (geschCmp !== 0) return geschCmp;
    
    // 3. Nach Familienname
    const famA = String(recA['Familienname'] ?? recA['Nachname'] ?? '');
    const famB = String(recB['Familienname'] ?? recB['Nachname'] ?? '');
    return famA.localeCompare(famB, 'de');
  };

  // Hintergrundfarbe je Stufe
  const getStufeColor = (stufe: string) => {
    const s = String(stufe).trim();
    switch (s) {
      case '0': return 'bg-stone-100';
      case '1': return 'bg-amber-100';
      case '2': return 'bg-lime-100';
      case '3': return 'bg-cyan-100';
      case '4': return 'bg-sky-100';
      case '5': return 'bg-violet-100';
      case '6': return 'bg-pink-100';
      case '7': return 'bg-orange-100';
      case '8': return 'bg-rose-100';
      default: return 'bg-gray-50';
    }
  };

  // Textfarbe je Geschlecht
  const getGeschlechtColor = (geschlecht: string) => {
    const g = String(geschlecht).trim().toLowerCase();
    if (g === 'w') return 'text-red-600 font-medium';
    if (g === 'm') return 'text-blue-600 font-medium';
    return '';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Übersicht Stufen 4, 5, 6</h1>
        <div className="flex items-center gap-4">
          <SchuljahresWechsler />
          <a href="/uebersicht" className="text-sm text-blue-600 underline">← Zurück</a>
        </div>
      </div>
      
      <p className="text-gray-600 text-sm">Klassen: {KLASSEN_PREFIXES.join(', ')} | Schuljahr {schuljahrLabel}</p>

      {loading && <div className="text-sm">Lade Klassenlisten…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      
      {!loading && !error && filteredKlassen.length === 0 && (
        <div className="text-gray-500">Keine Klassen gefunden.</div>
      )}

      {!loading && !error && filteredKlassen.map(klasse => (
        <div key={klasse} className="border rounded bg-white shadow-sm">
          <div className="bg-lime-100 px-4 py-2 font-semibold border-b flex justify-between items-center">
            <span>Klasse {klasse}</span>
            <span className="text-sm text-gray-600">{studentsByKlasse[klasse]?.length || 0} Schüler</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold w-12">Nr.</th>
                  <th className="text-left px-3 py-2 font-semibold">Vorname</th>
                  <th className="text-left px-3 py-2 font-semibold">Familienname</th>
                  <th className="text-left px-3 py-2 font-semibold">Stufe</th>
                  <th className="text-left px-3 py-2 font-semibold">Geschlecht</th>
                  <th className="text-left px-3 py-2 font-semibold">Religion</th>
                  <th className="text-left px-3 py-2 font-semibold">Muttersprache</th>
                  <th className="text-left px-3 py-2 font-semibold">SBJ</th>
                </tr>
              </thead>
              <tbody>
                {(studentsByKlasse[klasse] || [])
                  .sort(sortStudents)
                  .map((student, i) => {
                    const rec = student as Record<string, unknown>;
                    const fam = rec['Familienname'] ?? rec['Nachname'] ?? '';
                    const stufe = String(rec[stufeFeld] || '');
                    const geschlecht = String(rec['Geschlecht'] || '');
                    return (
                      <tr key={student._id || i} className={getStufeColor(stufe)}>
                        <td className="px-3 py-1">{i + 1}</td>
                        <td className="px-3 py-1">{student.Vorname || ''}</td>
                        <td className="px-3 py-1">{String(fam)}</td>
                        <td className="px-3 py-1">{stufe}</td>
                        <td className={`px-3 py-1 ${getGeschlechtColor(geschlecht)}`}>{geschlecht}</td>
                        <td className="px-3 py-1">{String(rec['Religion'] || '')}</td>
                        <td className="px-3 py-1">{String(rec['Muttersprache'] || '')}</td>
                        <td className="px-3 py-1">{String(rec['Besuchsjahr'] || '')}</td>
                      </tr>
                    );
                  })}
                {(!studentsByKlasse[klasse] || studentsByKlasse[klasse].length === 0) && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-gray-500 text-xs">
                      Keine Schüler
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
