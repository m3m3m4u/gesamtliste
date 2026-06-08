"use client";
import React, { useRef, useState } from 'react';
import { useSchuljahr } from '@/lib/schuljahr';

interface ParsedStudent {
  Vorname?: string;
  Familienname?: string;
  Geburtsdatum?: string;
  [key: string]: unknown;
}

interface ExistingDoc {
  _id: string;
  Vorname?: string;
  Familienname?: string;
  Geburtsdatum?: string;
  [key: string]: unknown;
}

interface DuplicateEntry {
  imported: ParsedStudent;
  existing: ExistingDoc;
}

type DupAction = 'update' | 'create' | 'skip';

const ACTION_LABELS: Record<DupAction, string> = {
  update: 'Klasse + Stufe aktualisieren',
  create: 'Trotzdem neu anlegen',
  skip: 'Überspringen',
};

const PREVIEW_COLS = [
  'Vorname',
  'Familienname',
  'Geburtsdatum',
  'Geschlecht',
  'Muttersprache',
  'Religion',
  'Sokrates ID',
  'Familien-ID',
];

function getCols(students: ParsedStudent[]): string[] {
  const seen = new Set<string>();
  students.forEach((s) => Object.keys(s).forEach((k) => seen.add(k)));
  const preferred = PREVIEW_COLS.filter((c) => seen.has(c));
  const rest = Array.from(seen).filter((c) => !PREVIEW_COLS.includes(c)).sort();
  return [...preferred, ...rest];
}

function cellVal(s: ParsedStudent, col: string): string {
  const val = s[col];
  if (Array.isArray(val)) return (val as string[]).join(', ');
  if (val != null) return String(val);
  return '';
}

function StudentTable({ students }: { students: ParsedStudent[] }) {
  const cols = getCols(students);
  return (
    <div className="overflow-x-auto border rounded">
      <table className="text-xs min-w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-1 text-left text-gray-500 font-semibold border-b">#</th>
            {cols.map((c) => (
              <th key={c} className="px-2 py-1 text-left text-gray-700 font-semibold border-b whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-2 py-1 text-gray-400 border-r">{i + 1}</td>
              {cols.map((c) => {
                const display = cellVal(s, c);
                return (
                  <td key={c} className="px-2 py-1 whitespace-nowrap max-w-[160px] truncate" title={display}>
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SchuelerImport() {
  const { schuljahr } = useSchuljahr();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [importing, setImporting] = useState(false);

  const [newStudents, setNewStudents] = useState<ParsedStudent[] | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateEntry[] | null>(null);
  const [dupActions, setDupActions] = useState<Record<number, DupAction>>({});

  function reset() {
    setNewStudents(null);
    setDuplicates(null);
    setDupActions({});
    setParseErrors([]);
    setImportStatus(null);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFileName(f ? f.name : '');
    setNewStudents(null);
    setDuplicates(null);
    setDupActions({});
    setImportStatus(null);
    setParseErrors([]);
  }

  async function handlePreview() {
    const file = fileRef.current?.files?.[0];
    if (!file) { alert('Bitte zuerst eine Excel-Datei auswählen.'); return; }
    setLoading(true);
    setImportStatus(null);
    setParseErrors([]);
    setNewStudents(null);
    setDuplicates(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const parseRes = await fetch('/api/students/parse-excel', { method: 'POST', body: fd });
      const parseData = await parseRes.json();
      if (!parseRes.ok) {
        setImportStatus({ type: 'error', msg: parseData.error ?? 'Fehler beim Einlesen.' });
        return;
      }
      const allStudents: ParsedStudent[] = parseData.students;
      setParseErrors(parseData.errors ?? []);

      const checkRes = await fetch('/api/students/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: allStudents, schuljahr }),
      });
      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        setImportStatus({ type: 'error', msg: checkData.error ?? 'Fehler bei Duplikatprüfung.' });
        return;
      }

      setNewStudents(checkData.newStudents);
      const dups: DuplicateEntry[] = checkData.duplicates;
      setDuplicates(dups);
      const defaults: Record<number, DupAction> = {};
      dups.forEach((_, i) => { defaults[i] = 'update'; });
      setDupActions(defaults);
    } catch {
      setImportStatus({ type: 'error', msg: 'Netzwerkfehler.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (newStudents === null || duplicates === null) return;

    const toCreate: ParsedStudent[] = [
      ...newStudents,
      ...duplicates.filter((_, i) => dupActions[i] === 'create').map((d) => d.imported),
    ];
    const toUpdate = duplicates.filter((_, i) => dupActions[i] === 'update');
    const skipCount = duplicates.filter((_, i) => dupActions[i] === 'skip').length;

    if (toCreate.length + toUpdate.length === 0) {
      alert('Keine Aktion ausgewählt – alle Einträge werden übersprungen.');
      return;
    }
    if (!confirm(`${toCreate.length} neu anlegen, ${toUpdate.length} aktualisieren, ${skipCount} überspringen. Fortfahren?`)) return;

    setImporting(true);
    setImportStatus(null);
    const msgs: string[] = [];

    try {
      if (toCreate.length > 0) {
        const res = await fetch('/api/students/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students: toCreate }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Fehler beim Anlegen.');
        msgs.push(`${data.inserted} neu angelegt`);
      }

      const klasseFeld = `Klasse ${schuljahr}`;
      const stufeFeld = `Stufe ${schuljahr}`;
      let updateOk = 0;
      let updateFail = 0;
      for (const dup of toUpdate) {
        const patch: Record<string, unknown> = {};
        if (dup.imported[klasseFeld] !== undefined) patch[klasseFeld] = dup.imported[klasseFeld];
        if (dup.imported[stufeFeld] !== undefined) patch[stufeFeld] = dup.imported[stufeFeld];
        if (dup.imported['Besuchsjahr'] !== undefined) patch['Besuchsjahr'] = dup.imported['Besuchsjahr'];
        try {
          const res = await fetch(`/api/students/${dup.existing._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
          if (res.ok) { updateOk++; } else { updateFail++; }
        } catch { updateFail++; }
      }
      if (updateOk > 0) msgs.push(`${updateOk} aktualisiert`);
      if (updateFail > 0) msgs.push(`${updateFail} Aktualisierung(en) fehlgeschlagen`);
      if (skipCount > 0) msgs.push(`${skipCount} übersprungen`);

      setImportStatus({ type: updateFail > 0 ? 'error' : 'success', msg: msgs.join(', ') + '.' });
      reset();
    } catch (e) {
      setImportStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Unbekannter Fehler.' });
    } finally {
      setImporting(false);
    }
  }

  const hasPreview = newStudents !== null && duplicates !== null;
  const klasseFeld = `Klasse ${schuljahr}`;
  const stufeFeld = `Stufe ${schuljahr}`;
  // Vorjahres-Felder für "bisherig"
  function prevSj(sj: string): string {
    const [a, b] = sj.split('/');
    const ya = parseInt(a); const yb = parseInt(b);
    if (isNaN(ya) || isNaN(yb)) return '';
    return `${ya - 1}/${yb - 1}`;
  }
  const prevSchuljahr = prevSj(schuljahr);
  const prevKlasseFeld = `Klasse ${prevSchuljahr}`;
  const prevStufeFeld = `Stufe ${prevSchuljahr}`;

  return (
    <div className="mt-8 border-t pt-6">
      <h2 className="text-lg font-semibold mb-1">Schüler importieren (Excel)</h2>
      <p className="text-xs text-gray-500 mb-4">
        Vorlage herunterladen, ausfüllen und hochladen. Die Musterzeile bitte vor dem Upload löschen.
      </p>

      <div className="mb-5">
        <a
          href={`/api/students/import-template?schuljahr=${encodeURIComponent(schuljahr)}`}
          download
          className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded shadow transition-colors"
        >
          Vorlage herunterladen (.xlsx)
        </a>
        <span className="ml-3 text-xs text-gray-400">Schuljahr: {schuljahr}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-50 text-sm px-4 py-2 rounded shadow-sm transition-colors">
          Datei auswählen
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
        </label>
        {fileName && <span className="text-sm text-gray-700 truncate max-w-xs">{fileName}</span>}
        <button
          onClick={handlePreview}
          disabled={!fileName || loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm px-4 py-2 rounded shadow transition-colors"
        >
          {loading ? 'Prüfen...' : 'Vorschau & Duplikatprüfung'}
        </button>
      </div>

      {parseErrors.length > 0 && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800 space-y-1">
          <strong>Hinweise beim Einlesen:</strong>
          {parseErrors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {importStatus && (
        <div className={`mb-4 p-3 rounded text-sm font-medium ${
          importStatus.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-300'
            : 'bg-red-50 text-red-800 border border-red-300'
        }`}>
          {importStatus.msg}
        </div>
      )}

      {hasPreview && (
        <div className="space-y-6">

          {/* Neue Schüler */}
          <div>
            <h3 className="text-sm font-semibold text-green-700 mb-2">
              Neu anlegen: {newStudents!.length} Schüler
            </h3>
            {newStudents!.length > 0
              ? <StudentTable students={newStudents!} />
              : <p className="text-xs text-gray-400">Keine neuen Schüler.</p>
            }
          </div>

          {/* Duplikate */}
          {duplicates!.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-orange-700 mb-2">
                Bereits vorhanden: {duplicates!.length} Schüler – Aktion wählen
              </h3>
              <div className="border rounded overflow-x-auto">
                <table className="text-xs min-w-full">
                  <thead className="bg-orange-50">
                    <tr>
                      <th className="px-2 py-2 text-left border-b font-semibold text-gray-700">Name</th>
                      <th className="px-2 py-2 text-left border-b font-semibold text-gray-700">Geburtsdatum</th>
                      <th className="px-2 py-2 text-left border-b font-semibold text-gray-500">Bisherige Klasse</th>
                      <th className="px-2 py-2 text-left border-b font-semibold text-gray-500">Bisherige Stufe</th>
                      <th className="px-2 py-2 text-left border-b font-semibold text-gray-700">Neue {klasseFeld}</th>
                      <th className="px-2 py-2 text-left border-b font-semibold text-gray-700">Neue {stufeFeld}</th>
                      <th className="px-2 py-2 text-left border-b font-semibold text-gray-700">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicates!.map((dup, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-orange-50/40'}>
                        <td className="px-2 py-1 whitespace-nowrap font-medium">
                          {dup.existing.Vorname} {dup.existing.Familienname}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-gray-500">
                          {String(dup.existing.Geburtsdatum ?? '').slice(0, 10) || '–'}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-gray-400">
                          {String(dup.existing[prevKlasseFeld] ?? dup.existing['Klasse 25/26'] ?? '–')}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-gray-400">
                          {String(dup.existing[prevStufeFeld] ?? dup.existing['Stufe 25/26'] ?? '–')}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-blue-700 font-medium">
                          {String(dup.imported[klasseFeld] ?? '') || '–'}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-blue-700 font-medium">
                          {String(dup.imported[stufeFeld] ?? '') || '–'}
                        </td>
                        <td className="px-2 py-1">
                          <select
                            value={dupActions[i] ?? 'update'}
                            onChange={(e) => setDupActions((prev) => ({ ...prev, [i]: e.target.value as DupAction }))}
                            className={`border rounded px-1 py-0.5 text-xs ${
                              dupActions[i] === 'skip' ? 'bg-gray-100 text-gray-400' :
                              dupActions[i] === 'create' ? 'bg-blue-50 border-blue-300' :
                              'bg-green-50 border-green-300'
                            }`}
                          >
                            {(Object.keys(ACTION_LABELS) as DupAction[]).map((a) => (
                              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex gap-2 flex-wrap text-xs items-center">
                <span className="text-gray-500">Alle auf einmal:</span>
                {(Object.keys(ACTION_LABELS) as DupAction[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => {
                      const all: Record<number, DupAction> = {};
                      duplicates!.forEach((_, i) => { all[i] = a; });
                      setDupActions(all);
                    }}
                    className="border px-2 py-0.5 rounded hover:bg-gray-100"
                  >
                    {ACTION_LABELS[a]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button onClick={reset} className="text-sm border px-4 py-2 rounded hover:bg-gray-50">
              Abbrechen
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm px-5 py-2 rounded shadow transition-colors"
            >
              {importing ? 'Wird ausgeführt...' : 'Importieren / Aktualisieren'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
