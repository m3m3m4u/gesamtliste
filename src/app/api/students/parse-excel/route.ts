import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// Array-Felder: werden aus kommagetrennte Strings geparst
const ARRAY_FIELDS = new Set([
  'Schwerpunkte',
  'Frühbetreuung',
  'Angebote',
  'Status',
]);

function formatDate(raw: unknown): string {
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof raw === 'number') {
    // Excel-Datumsserialnummer
    const date = XLSX.SSF.parse_date_code(raw);
    const y = date.y;
    const m = String(date.m).padStart(2, '0');
    const d = String(date.d).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    // DD.MM.YYYY -> YYYY-MM-DD
    const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    // bereits YYYY-MM-DD oder ähnlich
    return s.slice(0, 10);
  }
  return '';
}

// POST /api/students/parse-excel
// Nimmt eine Excel-Datei (multipart/form-data, Feld "file") und gibt
// die geparsten Schüler als JSON zurück (kein DB-Zugriff).
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Keine Datei hochgeladen (Feld "file" fehlt).' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: 'Excel-Datei enthält keine Tabellen.' },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    // raw: false -> Zahlen/Daten als formatierte Strings AUSSER cellDates-Daten
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'Die Tabelle enthält keine Datenzeilen (mindestens Kopfzeile + 1 Zeile nötig).' },
        { status: 400 }
      );
    }

    const headerRow = rows[0] as string[];
    const dataRows = rows.slice(1) as unknown[][];

    const students: Record<string, unknown>[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      // Leere Zeilen überspringen
      if (!row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
        continue;
      }

      const student: Record<string, unknown> = {};
      let hasContent = false;

      for (let j = 0; j < headerRow.length; j++) {
        const header = String(headerRow[j] ?? '').trim();
        if (!header) continue;

        const raw = row[j];
        const strVal = raw instanceof Date ? '' : String(raw ?? '').trim();

        if (header === 'Geburtsdatum') {
          const d = formatDate(raw);
          if (d) {
            student[header] = d;
            hasContent = true;
          }
        } else if (ARRAY_FIELDS.has(header)) {
          const arr = strVal
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          student[header] = arr;
          if (arr.length > 0) hasContent = true;
        } else if (header === 'Geschlecht') {
          const g = strVal.toLowerCase();
          student[header] = g === 'm' ? 'm' : g === 'w' ? 'w' : strVal || '';
          if (strVal) hasContent = true;
        } else if (header === 'Religion an/ab') {
          const t = strVal.toLowerCase();
          student[header] = t === 'an' ? 'an' : t === 'ab' ? 'ab' : strVal || '';
          if (strVal) hasContent = true;
        } else {
          if (strVal) {
            student[header] = strVal;
            hasContent = true;
          } else {
            student[header] = '';
          }
        }
      }

      if (!hasContent) continue;

      // Pflichtfelder prüfen
      if (!student['Vorname'] && !student['Familienname']) {
        errors.push(`Zeile ${i + 2}: Vorname und Familienname fehlen – Zeile wird übersprungen.`);
        continue;
      }

      students.push(student);
    }

    return NextResponse.json({ students, count: students.length, errors });
  } catch (e) {
    console.error('[parse-excel]', e);
    return NextResponse.json(
      { error: `Fehler beim Verarbeiten der Datei: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
