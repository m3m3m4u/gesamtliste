import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';

// GET /api/deckblatt-zip?klasse=...&schuljahr=...
// Generiert eine ZIP-Datei mit allen Deckblättern einer Klasse
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const klasse = searchParams.get('klasse');
  const schuljahr = searchParams.get('schuljahr') || '25/26';
  const klasseFeld = `Klasse ${schuljahr}`;

  if (!klasse) {
    return NextResponse.json({ error: 'klasse Parameter fehlt' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const col = db.collection('students');

    // Alle Schüler der Klasse laden
    const students = await col.find({ 
      [klasseFeld]: klasse, 
      _deleted: { $ne: true } 
    }).toArray();

    if (students.length === 0) {
      return NextResponse.json({ error: 'Keine Schüler in dieser Klasse gefunden' }, { status: 404 });
    }

    // Vorlage laden
    const templatePath = path.join(process.cwd(), 'public', 'Vorlagen', 'Deckblatt.docx');
    const templateContent = fs.readFileSync(templatePath, 'binary');

    // ZIP für alle Dokumente erstellen
    const outputZip = new PizZip();

    for (const student of students) {
      // Für jeden Schüler ein Dokument generieren
      const zip = new PizZip(templateContent);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[', end: ']' }
      });

      // Geburtsdatum formatieren (TT.MM.JJJJ)
      let geburtsdatum = '';
      if (student.Geburtsdatum) {
        const geb = student.Geburtsdatum;
        if (typeof geb === 'string') {
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

      // Generiertes Dokument
      const docBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

      // Dateiname
      const vorname = (student.Vorname || '').replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_');
      const nachname = (student.Familienname || '').replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_');
      const filename = `Deckblatt_${nachname}_${vorname}.docx`;

      // Zur ZIP hinzufügen
      outputZip.file(filename, docBuffer);
    }

    // ZIP generieren
    const zipBuffer = outputZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    // Klassenname für Dateiname bereinigen
    const klasseClean = klasse.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_');
    const zipFilename = `Deckblaetter_${klasseClean}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
      },
    });
  } catch (error) {
    console.error('ZIP-Generierung fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Fehler bei der ZIP-Generierung', details: String(error) },
      { status: 500 }
    );
  }
}
