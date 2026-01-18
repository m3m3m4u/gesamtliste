import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';

// GET /api/deckblatt?id=...
// Generiert ein Word-Dokument basierend auf der Vorlage für einen Schüler
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id Parameter fehlt' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const col = db.collection('students');

    // Schüler laden
    const student = await col.findOne({ _id: new ObjectId(id), _deleted: { $ne: true } });
    if (!student) {
      return NextResponse.json({ error: 'Schüler nicht gefunden' }, { status: 404 });
    }

    // Vorlage laden
    const templatePath = path.join(process.cwd(), 'public', 'Vorlagen', 'Deckblatt.docx');
    const templateContent = fs.readFileSync(templatePath, 'binary');

    // ZIP erstellen und Dokument generieren
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      // Eigener Parser für [...] Platzhalter
      delimiters: { start: '[', end: ']' }
    });

    // Geburtsdatum formatieren (TT.MM.JJJJ)
    let geburtsdatum = '';
    if (student.Geburtsdatum) {
      const geb = student.Geburtsdatum;
      if (typeof geb === 'string') {
        // Versuche das Datum zu parsen und neu zu formatieren
        const d = new Date(geb);
        if (!isNaN(d.getTime())) {
          const tag = String(d.getDate()).padStart(2, '0');
          const monat = String(d.getMonth() + 1).padStart(2, '0');
          const jahr = d.getFullYear();
          geburtsdatum = `${tag}.${monat}.${jahr}`;
        } else {
          geburtsdatum = geb;
        }
      } else if (geb instanceof Date) {
        const tag = String(geb.getDate()).padStart(2, '0');
        const monat = String(geb.getMonth() + 1).padStart(2, '0');
        const jahr = geb.getFullYear();
        geburtsdatum = `${tag}.${monat}.${jahr}`;
      }
    }

    // Daten einsetzen
    doc.render({
      Vorname: student.Vorname || '',
      Familienname: student.Familienname || '',
      Geburtsdatum: geburtsdatum,
      Klasse: student['Klasse 25/26'] || student['Klasse 26/27'] || '',
      Stufe: student['Stufe 25/26'] || student['Stufe 26/27'] || '',
      Benutzername: student.Benutzername || '',
      Geschlecht: student.Geschlecht || '',
    });

    // Generiertes Dokument als Buffer
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // Dateiname für Download
    const vorname = (student.Vorname || '').replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_');
    const nachname = (student.Familienname || '').replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_');
    const filename = `Deckblatt_${vorname}_${nachname}.docx`;

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Deckblatt-Generierung fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Dokumentgenerierung', details: String(error) },
      { status: 500 }
    );
  }
}
