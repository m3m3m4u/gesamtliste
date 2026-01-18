"use client";
import React, { useState } from 'react';

interface InlineEditRowProps {
  student: {
    _id?: string;
    Vorname?: string;
    Familienname?: string;
    [key: string]: unknown;
  };
  index: number;
  schuljahr: string;
  klasseFeld: string;
  stufeFeld: string;
  besuchsjahrFeld: string;
  availableKlassen: string[];
  getStufeColor: (stufe: string) => string;
  getGeschlechtColor: (geschlecht: string) => string;
  onSave: () => void;
  onCancel: () => void;
}

export function InlineEditRow({
  student,
  index,
  schuljahr,
  klasseFeld,
  stufeFeld,
  besuchsjahrFeld,
  availableKlassen,
  getStufeColor,
  getGeschlechtColor,
  onSave,
  onCancel,
}: InlineEditRowProps) {
  const rec = student as Record<string, unknown>;
  const fam = rec['Familienname'] ?? rec['Nachname'] ?? '';
  const geschlecht = String(rec['Geschlecht'] || '');
  
  const [klasse, setKlasse] = useState(String(rec[klasseFeld] || ''));
  const [stufe, setStufe] = useState(String(rec[stufeFeld] || ''));
  const [besuchsjahr, setBesuchsjahr] = useState(String(rec[besuchsjahrFeld] || ''));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        [klasseFeld]: klasse,
        [stufeFeld]: stufe,
        [besuchsjahrFeld]: besuchsjahr,
      };
      
      const res = await fetch(`/api/students/${student._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        onSave();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="bg-blue-50">
      <td className="px-3 py-1">
        <div className="flex gap-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-green-600 hover:text-green-800 disabled:opacity-50"
            title="Speichern"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={onCancel}
            className="text-red-600 hover:text-red-800"
            title="Abbrechen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </td>
      <td className="px-3 py-1">{index + 1}</td>
      <td className="px-3 py-1">{student.Vorname || ''}</td>
      <td className="px-3 py-1">{String(fam)}</td>
      <td className="px-3 py-1">
        <select
          value={klasse}
          onChange={(e) => setKlasse(e.target.value)}
          className="border rounded px-1 py-0.5 text-sm w-20"
        >
          <option value="">-</option>
          {availableKlassen.map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-1">
        <select
          value={stufe}
          onChange={(e) => setStufe(e.target.value)}
          className="border rounded px-1 py-0.5 text-sm w-14"
        >
          <option value="">-</option>
          {[0,1,2,3,4,5,6,7,8].map(s => (
            <option key={s} value={String(s)}>{s}</option>
          ))}
        </select>
      </td>
      <td className={`px-3 py-1 ${getGeschlechtColor(geschlecht)}`}>{geschlecht}</td>
      <td className="px-3 py-1">{String(rec['Religion'] || '')}</td>
      <td className="px-3 py-1">{String(rec['Muttersprache'] || '')}</td>
      <td className="px-3 py-1">
        <select
          value={besuchsjahr}
          onChange={(e) => setBesuchsjahr(e.target.value)}
          className="border rounded px-1 py-0.5 text-sm w-14"
        >
          <option value="">-</option>
          {[1,2,3,4,5,6,7,8,9,10].map(j => (
            <option key={j} value={String(j)}>{j}</option>
          ))}
        </select>
      </td>
    </tr>
  );
}

// Behalte den alten Export für Kompatibilität, aber er wird nicht mehr genutzt
export default function EditStudentModal() {
  return null;
}
