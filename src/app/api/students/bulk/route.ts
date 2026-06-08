import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// POST /api/students/bulk
// Importiert mehrere Schüler auf einmal.
// Body: { students: Record<string, unknown>[] }
export async function POST(request: Request) {
  try {
    const { students } = (await request.json()) as {
      students: Record<string, unknown>[];
    };

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { error: 'Keine Schüler im Request.' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();
    const col = db.collection('students');
    const now = new Date().toISOString();

    const toInsert = students.map((raw) => {
      const s = { ...raw, createdAt: now, updatedAt: now };

      // Klasse-Feld-Synchronisierung (analog zu POST /api/students)
      for (const key of Object.keys(s)) {
        if (key.startsWith('Klasse ')) {
          const rawK = s[key];
          const normK =
            typeof rawK === 'string'
              ? rawK.trim()
              : rawK == null
              ? ''
              : String(rawK);
          const sjKey = key.replace('Klasse ', ''); // z.B. "25/26"
          if (normK) {
            s[key] = normK;
            s[sjKey] = normK;
          } else {
            s[sjKey] = '';
          }
        }
      }

      // NormBenutzername
      if (typeof s['Benutzername'] === 'string') {
        const trimmed = (s['Benutzername'] as string).trim();
        s['Benutzername'] = trimmed;
        if (trimmed) {
          s['NormBenutzername'] = trimmed.toLowerCase();
        }
      }

      return s;
    });

    const result = await col.insertMany(toInsert, { ordered: false });

    return NextResponse.json({ inserted: result.insertedCount }, { status: 201 });
  } catch (e) {
    console.error('[bulk import]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Fehler beim Import' },
      { status: 500 }
    );
  }
}
