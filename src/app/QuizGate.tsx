"use client";
import React, { useEffect, useState } from 'react';

// Simple Quiz statt Passwort. Frage zum Sicherheitsstandard.
// Nur UI-Schranke – kein echter Schutz, gewollt laut Anforderung.

const STORAGE_KEY = 'quiz_gate_ok';

const question = 'Welcher einfache Sicherheitsstandard wird hier NICHT wirklich eingesetzt, sondern nur simuliert?';
const options = [
  'ISO 27001 mit vollständigem ISMS',
  'Wir tun so als ob',
  'Ende-zu-Ende-Quantenverschlüsselung',
  'KI-gestützte Zero-Trust-Blockchain'
];
// Richtige (humorvolle) Antwort definieren
const correctIndex = 1;

export default function QuizGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setOk(true);
      else setOk(false);
    } catch { setOk(false); }
  }, []);

  function submit() {
    if (answer === correctIndex) {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
      setOk(true);
    } else {
      setSubmitted(true);
    }
  }

  if (ok) return <>{children}</>;
  if (ok === null) return <div className="p-6 text-sm text-gray-600">Lade…</div>;

  return (
    <div className="w-full max-w-md mx-auto mt-16 p-6 bg-white rounded shadow border space-y-4">
      <h2 className="text-lg font-semibold">Leichter Zugang</h2>
  <p className="text-sm text-gray-600">Kein Passwort mehr. Stattdessen ein kleines &quot;Quiz&quot; (rein symbolisch).</p>
      <div className="space-y-2">
        <p className="font-medium text-sm">{question}</p>
        <div className="space-y-1">
          {options.map((opt,i) => (
            <label key={i} className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="radio" name="quiz" value={i} onChange={() => { setAnswer(i); setSubmitted(false); }} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
      {submitted && answer !== correctIndex && (
        <div className="text-xs text-red-600">Nicht ganz. Humorvolle Antwort wählen.</div>
      )}
      <button onClick={submit} className="px-3 py-1 bg-blue-600 text-white text-sm rounded disabled:opacity-50" disabled={answer==null}>Freischalten</button>
      <p className="text-[11px] text-gray-400 leading-snug">
        Hinweis: Dies ist kein echter Sicherheitsmechanismus, nur eine weiche Schranke gegen versehentliches Bearbeiten.
      </p>
    </div>
  );
}
