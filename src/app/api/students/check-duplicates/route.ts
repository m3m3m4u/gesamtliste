import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

interface ImportedStudent {
  Vorname?: string;
  Familienname?: string;
  Geburtsdatum?: string;
  'Sokrates ID'?: string;
  [key: string]: unknown;
}

interface ExistingDoc {
  _id: string;
  Vorname?: string;
  Familienname?: string;
  Geburtsdatum?: string;
  [key: string]: unknown;
}

function normalize(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Nur der erste Vorname (erstes Wort)
function firstVorname(s: unknown): string {
  return normalize(String(s ?? '').split(/\s+/)[0] ?? '');
}

// Geburtsdatum immer als YYYY-MM-DD normalisieren
// Unterstützt: YYYY-MM-DD, DD.MM.YYYY, YYYY-MM-DDTHH:... (ISO)
function normalizeGeb(s: unknown): string {
  const raw = String(s ?? '').trim();
  if (!raw) return '';
  // DD.MM.YYYY
  const dmy = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  // ISO oder YYYY-MM-DD: einfach erste 10 Zeichen
  return raw.slice(0, 10);
}

// POST /api/students/check-duplicates
// Body: { students: ImportedStudent[] }
// Prüft jeden importierten Schüler gegen die DB:
//   - zuerst via Sokrates ID (falls vorhanden)
//   - sonst via Vorname + Familienname + Geburtsdatum
// Gibt zurück: { newStudents, duplicates }
function prevSj(sj: string): string {
  const [a, b] = sj.split('/');
  const ya = parseInt(a); const yb = parseInt(b);
  if (isNaN(ya) || isNaN(yb)) return '';
  return `${ya - 1}/${yb - 1}`;
}

export async function POST(request: Request) {
  try {
    const { students, schuljahr } = (await request.json()) as { students: ImportedStudent[]; schuljahr?: string };

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ newStudents: [], duplicates: [] });
    }

    const client = await clientPromise;
    const db = client.db();
    const col = db.collection<ExistingDoc>('students');

    // Alle nicht-gelöschten Schüler aus DB laden (nur relevante Felder)
    const dbStudents = await col
      .find(
        { _deleted: { $ne: true } },
        {
          projection: {
            _id: 1,
            Vorname: 1,
            Familienname: 1,
            Geburtsdatum: 1,
            'Sokrates ID': 1,
            'Klasse 25/26': 1,
            'Stufe 25/26': 1,
            'Klasse 26/27': 1,
            'Stufe 26/27': 1,
            ...(schuljahr ? { [`Klasse ${schuljahr}`]: 1, [`Stufe ${schuljahr}`]: 1, [`Klasse ${prevSj(schuljahr)}`]: 1, [`Stufe ${prevSj(schuljahr)}`]: 1 } : {}),
            Besuchsjahr: 1,
          },
        }
      )
      .toArray();

    // Index: Sokrates ID -> doc
    const bySokrates = new Map<string, ExistingDoc>();
    // Index: Familienname+Geburtsdatum -> docs (kann mehrere geben)
    const byFamGeb = new Map<string, ExistingDoc[]>();
    // Index: ersterVorname+Familienname+Geburtsdatum -> doc
    const byFirstVorFamGeb = new Map<string, ExistingDoc>();

    for (const doc of dbStudents) {
      const sid = String(doc['Sokrates ID'] ?? '').trim();
      if (sid) bySokrates.set(sid, doc as unknown as ExistingDoc);

      const geb = normalizeGeb(doc.Geburtsdatum);
      const fam = normalize(doc.Familienname);
      const firstVor = firstVorname(doc.Vorname);

      // Familienname + Geburtsdatum
      if (fam && geb) {
        const k = `${fam}|${geb}`;
        const arr = byFamGeb.get(k) ?? [];
        arr.push(doc as unknown as ExistingDoc);
        byFamGeb.set(k, arr);
      }

      // erster Vorname + Familienname + Geburtsdatum
      if (firstVor && fam && geb) {
        byFirstVorFamGeb.set(`${firstVor}|${fam}|${geb}`, doc as unknown as ExistingDoc);
      }
    }

    const newStudents: ImportedStudent[] = [];
    const duplicates: { imported: ImportedStudent; existing: ExistingDoc }[] = [];

    for (const student of students) {
      let found: ExistingDoc | undefined;

      const sid = String(student['Sokrates ID'] ?? '').trim();

      if (sid) {
        // Sokrates ID vorhanden → nur danach suchen, kein Fallback
        found = bySokrates.get(sid);
      } else {
        // Kein Sokrates ID → erster Vorname + Familienname + Geburtsdatum
        const geb = normalizeGeb(student.Geburtsdatum);
        const fam = normalize(student.Familienname);
        const firstVor = firstVorname(student.Vorname);
        if (firstVor && fam && geb) {
          found = byFirstVorFamGeb.get(`${firstVor}|${fam}|${geb}`);
        }
        // Falls immer noch nicht gefunden: Familienname + Geburtsdatum (nur bei eindeutigem Treffer)
        if (!found && fam && geb) {
          const candidates = byFamGeb.get(`${fam}|${geb}`) ?? [];
          if (candidates.length === 1) found = candidates[0];
        }
      }

      if (found) {
        duplicates.push({ imported: student, existing: found });
      } else {
        newStudents.push(student);
      }
    }

    return NextResponse.json({ newStudents, duplicates });
  } catch (e) {
    console.error('[check-duplicates]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Fehler' },
      { status: 500 }
    );
  }
}
