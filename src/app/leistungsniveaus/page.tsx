"use client";
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface StudentDoc {
  _id: string;
  Vorname?: string;
  Familienname?: string;
  'Stufe 25/26'?: string | number;
  'm/w'?: string;
  Geschlecht?: string;
  // Leistungsniveaus
  'Niveau Mathematik'?: string;
  'Niveau Englisch'?: string;
  'Niveau Deutsch'?: string;
  [key: string]: unknown;
}

const NIVEAU_OPTIONS = ['', 'Standard AHS', 'Standard', 'ASO'] as const;

// Farben für Niveaus
function getNiveauColor(niveau: string): string {
  switch (niveau) {
    case 'Standard AHS': return 'bg-green-100 text-green-800 border-green-300';
    case 'Standard': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'ASO': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

export default function LeistungsniveausPage() {
  const stufeFeld = 'Stufe 25/26';

  const [availableKlassen, setAvailableKlassen] = useState<string[]>([]);
  const [selectedKlasse, setSelectedKlasse] = useState<string>('');
  const [data, setData] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Klassen laden, aber nur die relevanten (nicht A0*, B0*, C0*, B1*)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/students/distincts', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const arr: string[] = Array.isArray(json.klassen) 
          ? json.klassen.map((v: string) => v.trim()).filter((v: string) => v.length > 0)
          : [];
        
        // Filtern: nicht A0*, A1*, B0*, C0*, B10*
        const filtered = arr.filter(k => {
          const upper = k.toUpperCase();
          if (upper.startsWith('A0')) return false;
          if (upper.startsWith('A1')) return false;
          if (upper.startsWith('B0')) return false;
          if (upper.startsWith('C0')) return false;
          if (upper.startsWith('B10')) return false;
          // Nur reguläre Klassen (A, B, C gefolgt von Zahlen)
          return /^[ABC]\d/.test(upper);
        });
        
        setAvailableKlassen(filtered.sort((a, b) => a.localeCompare(b, 'de')));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Schüler der Klasse laden (nur Stufe 6, 7, 8)
  const loadStudents = useCallback(async () => {
    if (!selectedKlasse) {
      setData([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        klasse: selectedKlasse,
        limit: '100',
        fields: `Vorname,Familienname,${stufeFeld},m/w,Geschlecht,Niveau Mathematik,Niveau Englisch,Niveau Deutsch`
      });
      const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      
      // Nur Stufe 6, 7, 8
      const students = (json.items || []).filter((s: StudentDoc) => {
        const stufe = Number(s['Stufe 25/26'] || 0);
        return stufe >= 6 && stufe <= 8;
      });
      
      // Sortieren nach Familienname, Vorname
      students.sort((a: StudentDoc, b: StudentDoc) => {
        const famA = String(a.Familienname || '').toLowerCase();
        const famB = String(b.Familienname || '').toLowerCase();
        if (famA !== famB) return famA.localeCompare(famB, 'de');
        const vorA = String(a.Vorname || '').toLowerCase();
        const vorB = String(b.Vorname || '').toLowerCase();
        return vorA.localeCompare(vorB, 'de');
      });
      
      setData(students);
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedKlasse, stufeFeld]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Niveau speichern
  const saveNiveau = async (studentId: string, field: string, value: string) => {
    setSaving(studentId + field);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (!res.ok) throw new Error('Speichern fehlgeschlagen');
      
      // Lokal aktualisieren
      setData(prev => prev.map(s => 
        s._id === studentId ? { ...s, [field]: value } : s
      ));
    } catch (e) {
      console.error(e);
      alert('Fehler beim Speichern');
    } finally {
      setSaving(null);
    }
  };

  const NiveauSelect = ({ student, field }: { student: StudentDoc; field: string }) => {
    const currentValue = String(student[field] || '');
    const isSaving = saving === student._id + field;
    
    return (
      <select
        value={currentValue}
        onChange={(e) => saveNiveau(student._id, field, e.target.value)}
        disabled={isSaving}
        className={`w-full px-2 py-1 text-sm border rounded transition-colors ${getNiveauColor(currentValue)} ${isSaving ? 'opacity-50' : ''}`}
      >
        {NIVEAU_OPTIONS.map(opt => (
          <option key={opt} value={opt}>{opt || '–'}</option>
        ))}
      </select>
    );
  };

  return (
    <main className="w-full p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-indigo-600 hover:underline text-sm">← Hauptmenü</Link>
            <h1 className="text-2xl font-bold mt-2">Leistungsniveaus</h1>
            <p className="text-gray-500 text-sm">Stufen 6, 7 und 8</p>
          </div>
        </div>

        {/* Klassenauswahl */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Klasse wählen:</label>
          <div className="flex flex-wrap gap-2">
            {availableKlassen.map(k => (
              <button
                key={k}
                onClick={() => setSelectedKlasse(k)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedKlasse === k
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Tabelle */}
        {selectedKlasse && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Laden...</div>
            ) : data.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Keine Schüler der Stufen 6–8 in dieser Klasse.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Familienname
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vorname
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      Stufe
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                      Mathematik
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                      Englisch
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                      Deutsch
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((student, idx) => {
                    const stufe = student['Stufe 25/26'] || '';
                    return (
                      <tr key={student._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {student.Familienname}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {student.Vorname}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 text-center">
                          {stufe}
                        </td>
                        <td className="px-2 py-2">
                          <NiveauSelect student={student} field="Niveau Mathematik" />
                        </td>
                        <td className="px-2 py-2">
                          <NiveauSelect student={student} field="Niveau Englisch" />
                        </td>
                        <td className="px-2 py-2">
                          <NiveauSelect student={student} field="Niveau Deutsch" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Legende */}
        {selectedKlasse && data.length > 0 && (
          <div className="mt-4 flex gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span className={`inline-block w-4 h-4 rounded border ${getNiveauColor('Standard AHS')}`}></span>
              Standard AHS
            </span>
            <span className="flex items-center gap-1">
              <span className={`inline-block w-4 h-4 rounded border ${getNiveauColor('Standard')}`}></span>
              Standard
            </span>
            <span className="flex items-center gap-1">
              <span className={`inline-block w-4 h-4 rounded border ${getNiveauColor('ASO')}`}></span>
              ASO
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
