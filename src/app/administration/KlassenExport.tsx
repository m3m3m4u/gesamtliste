"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useSchuljahr } from '@/lib/schuljahr';
import { exportMultipleExcel, exportMultiplePDF, exportMultipleWord } from '@/lib/exporters';

interface ClassOption {
  value: string;
  label: string;
}

export default function KlassenExport() {
  const { schuljahr, stufeFeld, klasseFeld } = useSchuljahr();
  
  // State for available and selected classes
  const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  
  const spFeld = schuljahr === '25/26' ? 'Schwerpunkte' : `Schwerpunkte ${schuljahr}`;
  const fruehFeld = schuljahr === '25/26' ? 'Frühbetreuung' : `Frühbetreuung ${schuljahr}`;
  const angFeld = schuljahr === '25/26' ? 'Angebote' : `Angebote ${schuljahr}`;
  const sjKey = schuljahr.replace('/', '');

  // State for selected fields
  const FIELD_OPTIONS = [
    'Nr.',
    'Vorname',
    'Familienname',
    klasseFeld,
    stufeFeld,
    'Geschlecht',
    'Geburtsdatum',
    'Status',
    'Muttersprache',
    'Religion',
    'Religion an/ab',
    'Benutzername',
    'Passwort',
    angFeld,
    fruehFeld,
    spFeld,
    'Anton'
  ];
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'Nr.', 'Vorname', 'Familienname', klasseFeld
  ]);

  // Layout, sorting & format options
  const [onePagePerClass, setOnePagePerClass] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [groupByClass, setGroupByClass] = useState<boolean>(true);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Configuration options for filtering (Angebote, etc.)
  const [optAngebote, setOptAngebote] = useState<string[]>([]);
  const [optFrueh, setOptFrueh] = useState<string[]>([]);
  const [optSchwerpunkte, setOptSchwerpunkte] = useState<string[]>([]);

  const allowedAngebote = useMemo(() => new Set(optAngebote.map(s => String(s).trim().toLowerCase()).filter(Boolean)), [optAngebote]);
  const allowedFrueh = useMemo(() => new Set(optFrueh.map(s => String(s).trim().toLowerCase()).filter(Boolean)), [optFrueh]);
  const allowedSchwerpunkte = useMemo(() => new Set(optSchwerpunkte.map(s => String(s).trim().toLowerCase()).filter(Boolean)), [optSchwerpunkte]);

  // Load distinct classes and filter options
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/students/distincts?schuljahr=${encodeURIComponent(schuljahr)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Fehler beim Laden der Klassen.');
        const json = await res.json();
        
        const arr = Array.isArray(json.klassen) ? json.klassen.map((v: string) => v.trim()).filter((v: string) => v.length > 0) : [];
        const opts: ClassOption[] = (arr as string[]).sort((a, b) => a.localeCompare(b, 'de')).map((v: string) => ({ value: v, label: v }));
        
        setAvailableClasses(opts);
        
        // Load option definitions
        const optRes = await fetch('/api/options', { cache: 'no-store' });
        if (optRes.ok) {
          const ov = await optRes.json();
          const angKey = `angebote_${sjKey}`;
          const fruehKey = `fruehbetreuung_${sjKey}`;
          const spKey = `schwerpunkte_${sjKey}`;
          setOptAngebote(Array.isArray(ov[angKey]) ? ov[angKey] : Array.isArray(ov.angebote) ? ov.angebote : []);
          setOptFrueh(Array.isArray(ov[fruehKey]) ? ov[fruehKey] : Array.isArray(ov.fruehbetreuung) ? ov.fruehbetreuung : []);
          setOptSchwerpunkte(Array.isArray(ov[spKey]) ? ov[spKey] : Array.isArray(ov.schwerpunkte) ? ov.schwerpunkte : []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Klassen konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    })();
  }, [schuljahr]);

  // Toggle class selection
  const handleToggleClass = (klass: string) => {
    setSelectedClasses(prev =>
      prev.includes(klass) ? prev.filter(x => x !== klass) : [...prev, klass]
    );
  };

  // Select/Deselect all classes
  const handleSelectAllClasses = () => {
    setSelectedClasses(availableClasses.map(c => c.value));
  };
  const handleDeselectAllClasses = () => {
    setSelectedClasses([]);
  };

  // Toggle field selection
  const handleToggleField = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field) ? prev.filter(x => x !== field) : [...prev, field]
    );
  };

  // Select/Deselect all fields
  const handleSelectAllFields = () => {
    setSelectedFields(FIELD_OPTIONS);
  };
  const handleDeselectAllFields = () => {
    setSelectedFields(['Nr.']);
  };

  // Normalization helpers
  const fmtDate = (v: unknown): string => {
    if (typeof v === 'string') {
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO
      if (m) return `${m[3]}.${m[2]}.${m[1]}`;
      const m2 = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); // already formatted
      if (m2) return v;
    }
    return String(v ?? '');
  };

  const normalizeKey = (k: string) => k
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  const isRelAnAbVariant = (k: string) => /^religi?onanab$/.test(normalizeKey(k));

  const getRelAnAb = (rec: Record<string, unknown>): string => {
    let raw: unknown = rec['Religion an/ab'];
    if (typeof raw !== 'string') {
      for (const key of Object.keys(rec)) {
        if (key !== 'Religion an/ab' && isRelAnAbVariant(key)) { raw = rec[key]; break; }
      }
    }
    if (typeof raw === 'string') {
      const g = raw.trim().toLowerCase();
      return g === 'an' ? 'an' : g === 'ab' ? 'ab' : '';
    }
    return '';
  };

  const toArr = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
    if (v == null) return [];
    const s = String(v).trim();
    if (!s) return [];
    return s.split(/[,;/\n\r\t]+/).map(x => x.trim()).filter(Boolean);
  };

  function getCellValue(student: any, field: string): string {
    const rec = student as Record<string, unknown>;
    
    if (field === 'Familienname') {
      return String(rec['Familienname'] ?? rec['Nachname'] ?? '');
    }
    if (field === 'Religion an/ab') {
      return getRelAnAb(rec);
    }
    if (field === angFeld || field === fruehFeld) {
      const val = rec[field];
      const allowed = field === angFeld ? allowedAngebote : allowedFrueh;
      const arr = toArr(val);
      const filtered = allowed.size ? arr.filter(v => allowed.has(v.toLowerCase())) : arr;
      return filtered.join(', ');
    }
    if (field === spFeld) {
      let val = rec[spFeld];
      if (schuljahr === '25/26' && (val == null || (Array.isArray(val) && val.length === 0))) {
        val = rec['Schwerpunkt'];
      }
      const arr = toArr(val);
      const filtered = allowedSchwerpunkte.size ? arr.filter(v => allowedSchwerpunkte.has(v.toLowerCase())) : arr;
      return filtered.join(', ');
    }
    if (field === stufeFeld) {
      const val = rec[stufeFeld];
      if (val == null || String(val).trim() === '' || val === '-' || val === '—') return '0';
      return String(val);
    }
    if (field === 'Geburtsdatum') {
      return fmtDate(rec['Geburtsdatum']);
    }
    
    const val = rec[field];
    if (Array.isArray(val)) return val.join(', ');
    if (val == null) return '';
    return String(val).replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
  }

  // Trigger export
  const handleExport = async (format: 'excel' | 'docx' | 'pdf') => {
    if (selectedClasses.length === 0) {
      alert('Bitte wählen Sie mindestens eine Klasse aus.');
      return;
    }
    if (selectedFields.length === 0 || (selectedFields.length === 1 && selectedFields.includes('Nr.'))) {
      alert('Bitte wählen Sie mindestens ein Datenfeld zum Exportieren aus.');
      return;
    }

    setExporting(format);
    setError(null);
    setSuccess(null);

    try {
      // Build query string for multiple classes
      const params = new URLSearchParams({
        schuljahr,
        limit: '5000'
      });
      selectedClasses.forEach(c => params.append('klasse', c));

      // Always request crucial fields for database synching or rendering
      const fetchFields = Array.from(new Set([
        ...selectedFields.filter(f => f !== 'Nr.'),
        schuljahr,
        klasseFeld,
        stufeFeld,
        'Familienname',
        'Nachname',
        'Vorname',
        'Benutzername',
        'Passwort',
        'Anton'
      ]));
      params.set('fields', fetchFields.join(','));

      const res = await fetch('/api/students?' + params.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Fehler beim Abrufen der Schülerdaten.');
      const data = await res.json();
      const students: any[] = data.items || [];

      if (students.length === 0) {
        throw new Error('Keine Schüler für die ausgewählten Klassen gefunden.');
      }

      // Group students by class and sort them
      const studentsByClass: Record<string, any[]> = {};
      selectedClasses.forEach(c => {
        studentsByClass[c] = [];
      });

      students.forEach(s => {
        const clsVal = String(s[klasseFeld] ?? s[schuljahr] ?? '').trim();
        // Match with case-insensitive check to be safe
        const matchedClass = selectedClasses.find(c => c.toLowerCase() === clsVal.toLowerCase());
        if (matchedClass) {
          studentsByClass[matchedClass].push(s);
        }
      });

      // Sorting helper values
      const getSortValue = (s: any, field: string): string => {
        if (field === 'name') {
          return `${s.Familienname ?? s.Nachname ?? ''} ${s.Vorname ?? ''}`.trim().toLowerCase();
        }
        if (field === 'vorname') {
          return String(s.Vorname ?? '').toLowerCase();
        }
        if (field === 'geburtsdatum') {
          const d = s.Geburtsdatum;
          if (typeof d === 'string') {
            const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) return m[1] + m[2] + m[3];
            const m2 = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
            if (m2) return m2[3] + m2[2] + m2[1];
          }
          return String(d ?? '').toLowerCase();
        }
        if (field === 'geschlecht') {
          return String(s.Geschlecht ?? s['m/w'] ?? '').toLowerCase();
        }
        return '';
      };

      const compareStudents = (a: any, b: any) => {
        const valA = getSortValue(a, sortBy);
        const valB = getSortValue(b, sortBy);
        
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        
        // Tie-breaker: name, then vorname
        const famA = String(a.Familienname ?? a.Nachname ?? '').toLowerCase();
        const famB = String(b.Familienname ?? b.Nachname ?? '').toLowerCase();
        if (famA !== famB) return famA.localeCompare(famB, 'de');
        
        const vorA = String(a.Vorname ?? '').toLowerCase();
        const vorB = String(b.Vorname ?? '').toLowerCase();
        return vorA.localeCompare(vorB, 'de');
      };

      // Headers construction (put 'Nr.' at the beginning if checked)
      const headersAll = selectedFields.slice();
      const hasNr = headersAll.includes('Nr.');
      const headers = hasNr ? ['Nr.', ...headersAll.filter(h => h !== 'Nr.')] : headersAll;

      let exportClasses;
      if (onePagePerClass || groupByClass) {
        // Group students by class and sort them
        exportClasses = selectedClasses
          .filter(c => studentsByClass[c].length > 0) // only include classes with students
          .map(c => {
            const classStudents = [...studentsByClass[c]];
            classStudents.sort(compareStudents);
            const rows = classStudents.map((student, idx) => 
              headers.map(h => h === 'Nr.' ? String(idx + 1) : getCellValue(student, h))
            );
            
            return {
              className: c,
              title: `Klassenliste ${c}`,
              headers,
              rows
            };
          });
      } else {
        // Sort all students globally across selected classes
        const allSortedStudents = [...students];
        allSortedStudents.sort(compareStudents);
        const rows = allSortedStudents.map((student, idx) => 
          headers.map(h => h === 'Nr.' ? String(idx + 1) : getCellValue(student, h))
        );
        
        exportClasses = [{
          className: 'Gesamt',
          title: `Klassenliste Gesamt`,
          headers,
          rows
        }];
      }

      if (exportClasses.length === 0) {
        throw new Error('Keine Schülerdaten in den ausgewählten Klassen vorhanden.');
      }

      const dateStr = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
      const filename = `klassenlisten_${dateStr}`;

      if (format === 'excel') {
        exportMultipleExcel(exportClasses, filename, onePagePerClass);
      } else if (format === 'pdf') {
        await exportMultiplePDF(exportClasses, filename, onePagePerClass);
      } else if (format === 'docx') {
        await exportMultipleWord(exportClasses, filename, onePagePerClass);
      }

      setSuccess(`Export erfolgreich abgeschlossen! (${format.toUpperCase()})`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Exportieren.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="mt-8 border-t pt-6 max-w-4xl">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Klassenlisten exportieren & drucken</h2>
      <p className="text-sm text-gray-600 mb-6">
        Generieren Sie Klassenlisten für alle oder ausgewählte Klassen. Wählen Sie Spalten, Layout und Format.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-800 rounded-md text-sm font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-800 rounded-md text-sm font-medium">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center space-x-2 py-4">
          <span className="inline-block h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span className="text-sm text-gray-500">Lade verfügbare Klassen...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Class Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-700">1. Klassen auswählen</h3>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAllClasses}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Alle auswählen
                </button>
                <span className="text-gray-300 text-xs">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllClasses}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Auswahl aufheben
                </button>
              </div>
            </div>
            {availableClasses.length === 0 ? (
              <p className="text-xs text-gray-500 italic">Keine Klassen für dieses Schuljahr vorhanden.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 bg-gray-50 p-4 border rounded-md">
                {availableClasses.map(c => {
                  const checked = selectedClasses.includes(c.value);
                  return (
                    <label
                      key={c.value}
                      className={`flex items-center justify-center space-x-1.5 p-2 border rounded-md cursor-pointer select-none text-xs transition ${
                        checked
                          ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleClass(c.value)}
                        className="hidden"
                      />
                      <span>{c.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="text-[11px] text-gray-500 mt-1">
              Ausgewählt: {selectedClasses.length} von {availableClasses.length} Klassen
            </div>
          </div>

          {/* 2. Field Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-700">2. Spalten / Daten auswählen</h3>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAllFields}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Alle auswählen
                </button>
                <span className="text-gray-300 text-xs">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllFields}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Standard zurücksetzen
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 bg-gray-50 p-4 border rounded-md">
              {FIELD_OPTIONS.map(f => {
                const checked = selectedFields.includes(f);
                return (
                  <label
                    key={f}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 border rounded-full cursor-pointer select-none text-xs transition ${
                      checked
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700 font-medium'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleField(f)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{f}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Layout & Sortierung */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">3. Layout & Sortierung</h3>
            <div className="border rounded-md bg-gray-50 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-md hover:bg-white transition flex-1">
                  <input
                    type="radio"
                    name="layout"
                    checked={onePagePerClass}
                    onChange={() => setOnePagePerClass(true)}
                    className="mt-1 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-700">Eine Seite pro Klasse</span>
                    <span className="block text-xs text-gray-500">
                      PDF/Word erzeugen einen Seitenumbruch nach jeder Klasse. Excel speichert jede Klasse in einem eigenen Tab (Worksheet).
                    </span>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-md hover:bg-white transition flex-1">
                  <input
                    type="radio"
                    name="layout"
                    checked={!onePagePerClass}
                    onChange={() => setOnePagePerClass(false)}
                    className="mt-1 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-700">Alles am Stück</span>
                    <span className="block text-xs text-gray-500">
                      Alle Klassen werden in einer einzigen, durchgehenden Gesamtliste exportiert.
                    </span>
                  </div>
                </label>
              </div>
              
              <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Sortieren nach</label>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="w-full border rounded px-2.5 py-1.5 bg-white text-xs"
                  >
                    <option value="name">Familienname, Vorname</option>
                    <option value="vorname">Vorname</option>
                    <option value="geburtsdatum">Geburtsdatum</option>
                    <option value="geschlecht">Geschlecht</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reihenfolge</label>
                  <select
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="w-full border rounded px-2.5 py-1.5 bg-white text-xs"
                  >
                    <option value="asc">Aufsteigend (A-Z / Älteste zuerst)</option>
                    <option value="desc">Absteigend (Z-A / Jüngste zuerst)</option>
                  </select>
                </div>

                {!onePagePerClass && (
                  <div className="flex items-center pt-5">
                    <label className="flex items-center space-x-2 cursor-pointer text-xs text-gray-700 select-none">
                      <input
                        type="checkbox"
                        checked={groupByClass}
                        onChange={e => setGroupByClass(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Nach Klassen gruppieren</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Export Formats */}
          <div className="border-t pt-6 flex flex-wrap gap-4 items-center justify-end">
            <span className="text-xs text-gray-500 mr-auto">
              Datenstand für Schuljahr: <strong className="text-gray-700">{schuljahr}</strong>
            </span>

            <button
              onClick={() => handleExport('excel')}
              disabled={exporting !== null}
              className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-55 text-white text-sm font-medium px-5 py-2.5 rounded shadow transition cursor-pointer"
            >
              {exporting === 'excel' ? (
                <>
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Generiere Excel...</span>
                </>
              ) : (
                <span>Excel (.xlsx)</span>
              )}
            </button>

            <button
              onClick={() => handleExport('docx')}
              disabled={exporting !== null}
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-55 text-white text-sm font-medium px-5 py-2.5 rounded shadow transition cursor-pointer"
            >
              {exporting === 'docx' ? (
                <>
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Generiere Word...</span>
                </>
              ) : (
                <span>Word (.docx)</span>
              )}
            </button>

            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
              className="inline-flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-55 text-white text-sm font-medium px-5 py-2.5 rounded shadow transition cursor-pointer"
            >
              {exporting === 'pdf' ? (
                <>
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Generiere PDF...</span>
                </>
              ) : (
                <span>PDF (.pdf)</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
