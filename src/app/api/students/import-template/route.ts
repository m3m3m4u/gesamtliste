import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// GET /api/students/import-template?schuljahr=26/27
// Liefert eine Excel-Vorlage mit Musterschüler zum Download
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schuljahr = searchParams.get('schuljahr') ?? '26/27';

  const headers = [
    'Vorname',
    'Familienname',
    'Geburtsdatum',
    `Klasse ${schuljahr}`,
    `Stufe ${schuljahr}`,
    'Besuchsjahr',
    'Geschlecht',
    'Muttersprache',
    'Religion',
    'Sokrates ID',
    'Familien-ID',
  ];

  const sampleStudent = [
    'Max',
    'Mustermann',
    '2015-09-12',
    '3A',
    '3',
    '5',
    'm',
    'Deutsch',
    'kath',
    'SK123456',
    'F-0042',
  ];

  const hinweiseData = [
    ['Feld', 'Beschreibung', 'Gültige Werte / Format'],
    ['Vorname', 'Vorname des Schülers', 'Text'],
    ['Familienname', 'Familienname des Schülers', 'Text'],
    ['Geburtsdatum', 'Geburtsdatum', 'JJJJ-MM-TT  (z.B. 2015-09-12)'],
    [`Klasse ${schuljahr}`, 'Klasse im Schuljahr', 'z.B. 1A, 2B, 3C ...'],
    [`Stufe ${schuljahr}`, 'Schulstufe', 'z.B. 1, 2, 3 ... 8'],
    ['Besuchsjahr', 'Wievieltes Besuchsjahr', 'z.B. 1, 2, 3 ...'],
    ['Geschlecht', 'Geschlecht', 'm  oder  w'],
    ['Muttersprache', 'Erstsprache / Muttersprache', 'Text (z.B. Deutsch, Türkisch, ...)'],
    ['Religion', 'Religionsbekenntnis', 'z.B. kath, ev, orth, ohne, ...'],
    ['Sokrates ID', 'Sokrates-Schülernummer', 'Text oder leer'],
    ['Familien-ID', 'Familienkennung', 'Text oder leer'],
  ];

  const wb = XLSX.utils.book_new();

  // Haupt-Sheet: Schüler
  const ws = XLSX.utils.aoa_to_sheet([headers, sampleStudent]);

  // Spaltenbreiten setzen
  ws['!cols'] = headers.map((h) => ({
    wch: Math.max(h.length + 4, 18),
  }));

  XLSX.utils.book_append_sheet(wb, ws, 'Schüler');

  // Hinweise-Sheet
  const wsHinweise = XLSX.utils.aoa_to_sheet(hinweiseData);
  wsHinweise['!cols'] = [{ wch: 22 }, { wch: 35 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsHinweise, 'Hinweise');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const sjSlug = schuljahr.replace('/', '-');
  return new NextResponse(buf as Buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="schueler-vorlage-${sjSlug}.xlsx"`,
    },
  });
}
