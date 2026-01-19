import fs from 'fs';

// NaN in JSON ersetzen vor dem Parsen
const raw = fs.readFileSync('data/import.json', 'utf8');
const cleaned = raw.replace(/:\s*NaN\b/g, ': null');
const data = JSON.parse(cleaned);

// Filtere Schüler mit Klasse 25/26
const schueler = data.filter(s => s['Klasse 25/26'] && s['Klasse 25/26'] !== 'NaN' && String(s['Klasse 25/26']).trim() !== '');

// Sortiere nach Klasse, dann Familienname, dann Vorname
schueler.sort((a, b) => {
  const klasseA = a['Klasse 25/26'] || '';
  const klasseB = b['Klasse 25/26'] || '';
  if (klasseA !== klasseB) return klasseA.localeCompare(klasseB, 'de');
  const famA = (a.Familienname || '').toLowerCase();
  const famB = (b.Familienname || '').toLowerCase();
  if (famA !== famB) return famA.localeCompare(famB, 'de');
  return ((a.Vorname || '')).localeCompare(b.Vorname || '', 'de');
});

// CSV Header
const header = ['Klasse 25/26', 'Familienname', 'Vorname'];

// CSV Zeilen
const escape = (val) => {
  if (val === null || val === undefined || val === 'NaN') return '';
  const str = Array.isArray(val) ? val.join('; ') : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

const lines = [header.join(',')];
for (const s of schueler) {
  const row = header.map(h => escape(s[h]));
  lines.push(row.join(','));
}

fs.writeFileSync('schueler_mit_klasse.csv', '\ufeff' + lines.join('\r\n'), 'utf8');
console.log('Exportiert: ' + schueler.length + ' Schüler in schueler_mit_klasse.csv');
