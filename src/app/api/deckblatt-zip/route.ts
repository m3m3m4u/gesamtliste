import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';

// Schwerpunkt-Mapping: Kürzel -> Volltext
const SCHWERPUNKT_MAP: Record<string, string> = {
  'Info': 'Informatik',
  'FB': 'Sportakademie Fußball',
  'HB': 'Sportakademie Handball',
  'GT': 'Sportakademie Gerätturnen',
};

// Hilfsfunktion: Schwerpunkt-Name normalisieren (für Export)
function normalizeSchwerpunkt(name: string): string {
  // Informatik-Varianten alle zu "Informatik" vereinheitlichen
  if (name.toLowerCase().startsWith('informatik')) {
    return 'Informatik';
  }
  return name;
}

// Hilfsfunktion: Angebot-Name normalisieren (für Export)
function normalizeAngebot(name: string): string {
  // Klammern entfernen
  let result = name.replace(/\s*\([^)]*\)/g, '').trim();
  // "Freies Werken DI" / "Freies Werken MI" -> "Kreatives Werken"
  if (result.match(/^Freies Werken\s+(DI|MI)$/i)) {
    return 'Kreatives Werken';
  }
  if (result.toLowerCase() === 'in 80 tönen') {
    return 'In 80 Tönen um die Welt';
  }
  return result;
}

// Hilfsfunktion: Prüft ob ein Angebot in der erlaubten Liste ist
function isErlaubtesAngebot(angebot: string, erlaubteAngebote: string[]): boolean {
  const normalized = normalizeAngebot(angebot).toLowerCase();
  return erlaubteAngebote.some(e => normalizeAngebot(e).toLowerCase() === normalized);
}

// Hilfsfunktion: Prüft ob ein Schwerpunkt in der erlaubten Liste ist
function isErlaubterSchwerpunkt(schwerpunkt: string, erlaubteSchwerpunkte: string[]): boolean {
  const normalized = normalizeSchwerpunkt(SCHWERPUNKT_MAP[schwerpunkt] || schwerpunkt).toLowerCase();
  return erlaubteSchwerpunkte.some(s => normalizeSchwerpunkt(s).toLowerCase() === normalized);
}

// Hilfsfunktion: Geburtsdatum formatieren
function formatGeburtsdatum(geb: unknown): string {
  if (!geb) return '';
  if (typeof geb === 'string') {
    const d = new Date(geb);
    if (!isNaN(d.getTime())) {
      const tag = String(d.getDate()).padStart(2, '0');
      const monat = String(d.getMonth() + 1).padStart(2, '0');
      const jahr = d.getFullYear();
      return `${tag}.${monat}.${jahr}`;
    }
    return geb;
  } else if (geb instanceof Date) {
    const tag = String(geb.getDate()).padStart(2, '0');
    const monat = String(geb.getMonth() + 1).padStart(2, '0');
    const jahr = geb.getFullYear();
    return `${tag}.${monat}.${jahr}`;
  }
  return '';
}

// Hilfsfunktion: Schwerpunkt-Satz generieren
function buildSchwerpunktSatz(student: Record<string, unknown>, erlaubteSchwerpunkte: string[]): string {
  // Schwerpunkte können als Array (Schwerpunkte) oder String (Schwerpunkt) gespeichert sein
  let schwerpunktRaw: string | undefined;
  
  // Zuerst Schwerpunkte (Plural, Array) prüfen
  const schwerpunkte = student['Schwerpunkte'] as string[] | string | undefined;
  if (Array.isArray(schwerpunkte) && schwerpunkte.length > 0) {
    schwerpunktRaw = schwerpunkte[0];
  } else if (typeof schwerpunkte === 'string' && schwerpunkte.trim()) {
    schwerpunktRaw = schwerpunkte.trim();
  }
  
  // Dann Schwerpunkt (Singular) prüfen
  if (!schwerpunktRaw) {
    const schwerpunkt = student['Schwerpunkt'] as string | undefined;
    if (schwerpunkt && typeof schwerpunkt === 'string' && schwerpunkt.trim()) {
      schwerpunktRaw = schwerpunkt.trim();
    }
  }
  
  // Zuletzt Schwerpunkt 1 (altes Format) prüfen
  if (!schwerpunktRaw) {
    const schwerpunkt1 = student['Schwerpunkt 1'] as string | undefined;
    if (schwerpunkt1 && schwerpunkt1 !== 'NaN') {
      schwerpunktRaw = schwerpunkt1;
    }
  }
  
  if (!schwerpunktRaw) return '';
  
  // Prüfen ob dieser Schwerpunkt in der erlaubten Liste ist
  if (!isErlaubterSchwerpunkt(schwerpunktRaw, erlaubteSchwerpunkte)) return '';
  
  // Erst Mapping anwenden, dann normalisieren
  let schwerpunktName = SCHWERPUNKT_MAP[schwerpunktRaw] || schwerpunktRaw;
  schwerpunktName = normalizeSchwerpunkt(schwerpunktName);
  const vorname = student.Vorname as string || '';
  
  return `${vorname} hat am Schwerpunkt „${schwerpunktName}" teilgenommen.`;
}

// Hilfsfunktion: Angebote-Satz generieren
// hatSchwerpunkt: wenn true, wird "Er/Sie" statt Vorname verwendet
function buildAngeboteSatz(student: Record<string, unknown>, hatSchwerpunkt: boolean, erlaubteAngebote: string[]): string {
  const angeboteRaw = student.Angebote as string[] | undefined;
  if (!angeboteRaw || !Array.isArray(angeboteRaw) || angeboteRaw.length === 0) return '';
  
  // Nur Angebote verwenden, die in der erlaubten Liste (aus /optionen) vorkommen
  const erlaubte = angeboteRaw.filter(a => isErlaubtesAngebot(a, erlaubteAngebote));
  if (erlaubte.length === 0) return '';
  
  // Normalisieren (Klammern entfernen, DI/MI entfernen) und Duplikate entfernen
  const angebote = [...new Set(erlaubte.map(normalizeAngebot).filter(a => a.length > 0))];
  if (angebote.length === 0) return '';
  
  // Subjekt: Vorname oder Er/Sie je nachdem ob Schwerpunkt vorhanden
  const geschlecht = student['m/w'] as string || student.Geschlecht as string || '';
  const vorname = student.Vorname as string || '';
  const subjekt = hatSchwerpunkt 
    ? (geschlecht === 'w' ? 'Sie' : 'Er')
    : vorname;
  
  // Grammatik anpassen je nach Anzahl
  if (angebote.length === 1) {
    return `${subjekt} hat an „${angebote[0]}" teilgenommen.`;
  } else if (angebote.length === 2) {
    return `${subjekt} hat an „${angebote[0]}" und „${angebote[1]}" teilgenommen.`;
  } else {
    // 3 oder mehr: Komma-getrennt, letztes mit "und"
    const letztes = angebote[angebote.length - 1];
    const vorherige = angebote.slice(0, -1).map(a => `„${a}"`).join(', ');
    return `${subjekt} hat an ${vorherige} und „${letztes}" teilgenommen.`;
  }
}

// Hilfsfunktion: Leistungsniveau-Satz generieren (nur für Stufe 6+)
function buildLeistungsniveauSatz(student: Record<string, unknown>): string {
  const stufe = Number(student['Stufe 25/26'] || 0);
  if (stufe < 6) return ''; // Für Stufe 1-5 keinen Satz
  
  const vorname = student.Vorname as string || '';
  const niveauDeutsch = student['Niveau Deutsch'] as string || '';
  const niveauEnglisch = student['Niveau Englisch'] as string || '';
  const niveauMathematik = student['Niveau Mathematik'] as string || '';
  
  // Wenn keine Niveaus gesetzt sind, leerer String
  if (!niveauDeutsch && !niveauEnglisch && !niveauMathematik) return '';
  
  // Fächer nach Niveau gruppieren
  const niveauGruppen: Record<string, string[]> = {};
  
  if (niveauDeutsch) {
    if (!niveauGruppen[niveauDeutsch]) niveauGruppen[niveauDeutsch] = [];
    niveauGruppen[niveauDeutsch].push('Deutsch');
  }
  if (niveauEnglisch) {
    if (!niveauGruppen[niveauEnglisch]) niveauGruppen[niveauEnglisch] = [];
    niveauGruppen[niveauEnglisch].push('Englisch');
  }
  if (niveauMathematik) {
    if (!niveauGruppen[niveauMathematik]) niveauGruppen[niveauMathematik] = [];
    niveauGruppen[niveauMathematik].push('Mathematik');
  }
  
  const niveaus = Object.keys(niveauGruppen);
  
  // Alle gleich
  if (niveaus.length === 1) {
    const niveau = niveaus[0];
    const faecher = niveauGruppen[niveau];
    if (faecher.length === 3) {
      return `${vorname} ist in Deutsch, Mathematik und Englisch dem Leistungsniveau „${niveau}" zugeteilt.`;
    } else if (faecher.length === 2) {
      return `${vorname} ist in ${faecher[0]} und ${faecher[1]} dem Leistungsniveau „${niveau}" zugeteilt.`;
    } else {
      return `${vorname} ist in ${faecher[0]} dem Leistungsniveau „${niveau}" zugeteilt.`;
    }
  }
  
  // Unterschiedliche Niveaus - Teile bauen
  const teile: string[] = [];
  for (const niveau of niveaus) {
    const faecher = niveauGruppen[niveau];
    if (faecher.length === 1) {
      teile.push(`in ${faecher[0]} dem Leistungsniveau „${niveau}"`);
    } else if (faecher.length === 2) {
      teile.push(`in ${faecher[0]} und ${faecher[1]} dem Leistungsniveau „${niveau}"`);
    } else {
      teile.push(`in ${faecher.slice(0, -1).join(', ')} und ${faecher[faecher.length - 1]} dem Leistungsniveau „${niveau}"`);
    }
  }
  
  // Teile zusammenfügen
  if (teile.length === 2) {
    return `${vorname} ist ${teile[0]}, ${teile[1]} zugeteilt.`;
  } else {
    return `${vorname} ist ${teile.join(', ')} zugeteilt.`;
  }
}

// Hilfsfunktion: Erstsprachunterricht-Satz generieren (für alle Stufen)
function buildErstsprachunterrichtSatz(student: Record<string, unknown>): string {
  const erstsprach = student['Erstsprachunterricht'] as string || '';
  if (!erstsprach) return '';
  
  const vorname = student.Vorname as string || '';
  
  return `${vorname} hat am Erstsprachenunterricht „${erstsprach}" teilgenommen.`;
}

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

    // Erlaubte Angebote und Schwerpunkte aus Optionen laden
    const configCol = db.collection('config');
    const optionen = await configCol.findOne({ _id: 'optionen' as unknown as import('mongodb').ObjectId });
    const erlaubteAngebote: string[] = Array.isArray(optionen?.angebote) ? optionen.angebote : [];
    const erlaubteSchwerpunkte: string[] = Array.isArray(optionen?.schwerpunkte) ? optionen.schwerpunkte : [];

    // Vorlage laden (neue blaue Vorlage)
    const templatePath = path.join(process.cwd(), 'public', 'Vorlagen', 'Deckblatt blau.docx');
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

      // Geschlechtsabhängige Texte
      const geschlecht = student.Geschlecht as string || '';
      const dieSchuelerIn = geschlecht === 'w' ? 'Die Schülerin' : 'Der Schüler';
      
      // Schulstufe = Stufe (interne Stufe entspricht der Schulstufe)
      const stufe = student['Stufe 25/26'] || student['Stufe 26/27'] || '';
      const schulstufe = stufe ? String(stufe) : '';

      // Daten einsetzen
      doc.render({
        Vorname: student.Vorname || '',
        Familienname: student.Familienname || '',
        Geburtsdatum: formatGeburtsdatum(student.Geburtsdatum),
        Klasse: student['Klasse 25/26'] || student['Klasse 26/27'] || '',
        Stufe: stufe,
        Schulstufe: schulstufe,
        Benutzername: student.Benutzername || '',
        Geschlecht: geschlecht,
        Religion: student.Religion || '',
        'Die Schülerin': dieSchuelerIn,
      });

      // Generiertes Dokument
      let docBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

      // Nachbearbeitung: #Schwerpunkt und #Angebote ersetzen
      const schwerpunktSatz = buildSchwerpunktSatz(student as unknown as Record<string, unknown>, erlaubteSchwerpunkte);
      const hatSchwerpunkt = schwerpunktSatz.length > 0;
      const angeboteSatz = buildAngeboteSatz(student as unknown as Record<string, unknown>, hatSchwerpunkt, erlaubteAngebote);
      const leistungsniveauSatz = buildLeistungsniveauSatz(student as unknown as Record<string, unknown>);

      const generatedZip = new PizZip(docBuffer);
      let documentXml = generatedZip.file('word/document.xml')?.asText() || '';
      
      // Word teilt manchmal Text in mehrere w:t Elemente auf - normalisiere #Erstsprachunterricht
      // Flexiblere Regex: Suche #Erst gefolgt von beliebigem XML bis s und dann prachunterricht
      documentXml = documentXml.replace(
        /<w:t>#Erst<\/w:t>.*?<w:t>s<\/w:t>.*?<w:t>prachunterricht<\/w:t>/gs,
        '<w:t>#Erstsprachunterricht</w:t>'
      );
      
      if (schwerpunktSatz) {
        // Leerzeichen am Ende, falls auch Angebote folgen
        const schwerpunktMitAbstand = angeboteSatz ? schwerpunktSatz + ' ' : schwerpunktSatz;
        documentXml = documentXml.replace(/#Schwerpunkt/g, schwerpunktMitAbstand);
      } else {
        documentXml = documentXml.replace(/#Schwerpunkt/g, '');
      }
      
      if (angeboteSatz) {
        documentXml = documentXml.replace(/#Angebote/g, angeboteSatz);
      } else {
        documentXml = documentXml.replace(/#Angebote/g, '');
      }
      
      // #Leistungsniveau ersetzen - für Stufe 1-5 leeren String einsetzen
      const stufeNum = Number(student['Stufe 25/26'] || 0);
      if (stufeNum >= 6 && leistungsniveauSatz) {
        documentXml = documentXml.replace(/#Leistungsniveau/g, leistungsniveauSatz);
      } else {
        // Stufe 1-5 oder keine Niveaus: einfach den Text entfernen (lässt leere Formatierung, aber sicher)
        documentXml = documentXml.replace(/#Leistungsniveau/g, '');
      }
      
      // #Erstsprachunterricht ersetzen
      const erstsprachunterrichtSatz = buildErstsprachunterrichtSatz(student as unknown as Record<string, unknown>);
      if (erstsprachunterrichtSatz) {
        documentXml = documentXml.replace(/#Erstsprachunterricht/g, erstsprachunterrichtSatz);
      } else {
        // Kein Erstsprachunterricht: einfach den Text entfernen
        documentXml = documentXml.replace(/#Erstsprachunterricht/g, '');
      }

      generatedZip.file('word/document.xml', documentXml);
      const finalBuffer = generatedZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

      // Dateiname
      const vorname = (student.Vorname || '').toString().replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_');
      const nachname = (student.Familienname || '').toString().replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_');
      const filename = `Deckblatt_${nachname}_${vorname}.docx`;

      // Zur ZIP hinzufügen
      outputZip.file(filename, finalBuffer);
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
