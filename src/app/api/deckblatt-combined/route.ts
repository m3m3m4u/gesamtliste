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
  if (name.toLowerCase().startsWith('informatik')) {
    return 'Informatik';
  }
  return name;
}

// Hilfsfunktion: Angebot-Name normalisieren (für Export)
function normalizeAngebot(name: string): string {
  let result = name.replace(/\s*\([^)]*\)/g, '').trim();
  if (result.match(/^Freies Werken\s+(DI|MI)$/i)) {
    return 'Kreatives Werken';
  }
  if (result.toLowerCase() === 'in 80 tönen') {
    return 'In 80 Tönen um die Welt';
  }
  return result;
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
function buildSchwerpunktSatz(student: Record<string, unknown>): string {
  let schwerpunktRaw: string | undefined;
  
  const schwerpunkte = student['Schwerpunkte'] as string[] | string | undefined;
  if (Array.isArray(schwerpunkte) && schwerpunkte.length > 0) {
    schwerpunktRaw = schwerpunkte[0];
  } else if (typeof schwerpunkte === 'string' && schwerpunkte.trim()) {
    schwerpunktRaw = schwerpunkte.trim();
  }
  
  if (!schwerpunktRaw) {
    const schwerpunkt = student['Schwerpunkt'] as string | undefined;
    if (schwerpunkt && typeof schwerpunkt === 'string' && schwerpunkt.trim()) {
      schwerpunktRaw = schwerpunkt.trim();
    }
  }
  
  if (!schwerpunktRaw) {
    const schwerpunkt1 = student['Schwerpunkt 1'] as string | undefined;
    if (schwerpunkt1 && schwerpunkt1 !== 'NaN') {
      schwerpunktRaw = schwerpunkt1;
    }
  }
  
  if (!schwerpunktRaw) return '';
  
  let schwerpunktName = SCHWERPUNKT_MAP[schwerpunktRaw] || schwerpunktRaw;
  schwerpunktName = normalizeSchwerpunkt(schwerpunktName);
  const vorname = student.Vorname as string || '';
  
  return `${vorname} hat am Schwerpunkt „${schwerpunktName}" teilgenommen.`;
}

// Hilfsfunktion: Angebote-Satz generieren
function buildAngeboteSatz(student: Record<string, unknown>, hatSchwerpunkt: boolean): string {
  const angeboteRaw = student.Angebote as string[] | undefined;
  if (!angeboteRaw || !Array.isArray(angeboteRaw) || angeboteRaw.length === 0) return '';
  
  const angebote = [...new Set(angeboteRaw.map(normalizeAngebot).filter(a => a.length > 0))];
  if (angebote.length === 0) return '';
  
  const geschlecht = student['m/w'] as string || student.Geschlecht as string || '';
  const vorname = student.Vorname as string || '';
  const subjekt = hatSchwerpunkt 
    ? (geschlecht === 'w' ? 'Sie' : 'Er')
    : vorname;
  
  if (angebote.length === 1) {
    return `${subjekt} hat an „${angebote[0]}" teilgenommen.`;
  } else if (angebote.length === 2) {
    return `${subjekt} hat an „${angebote[0]}" und „${angebote[1]}" teilgenommen.`;
  } else {
    const letztes = angebote[angebote.length - 1];
    const vorherige = angebote.slice(0, -1).map(a => `„${a}"`).join(', ');
    return `${subjekt} hat an ${vorherige} und „${letztes}" teilgenommen.`;
  }
}

// Hilfsfunktion: Leistungsniveau-Satz generieren (nur für Stufe 6+)
function buildLeistungsniveauSatz(student: Record<string, unknown>): string {
  const stufe = Number(student['Stufe 25/26'] || 0);
  if (stufe < 6) return '';
  
  const vorname = student.Vorname as string || '';
  const niveauDeutsch = student['Niveau Deutsch'] as string || '';
  const niveauEnglisch = student['Niveau Englisch'] as string || '';
  const niveauMathematik = student['Niveau Mathematik'] as string || '';
  
  if (!niveauDeutsch && !niveauEnglisch && !niveauMathematik) return '';
  
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
  
  if (teile.length === 2) {
    return `${vorname} ist ${teile[0]}, ${teile[1]} zugeteilt.`;
  } else {
    return `${vorname} ist ${teile.join(', ')} zugeteilt.`;
  }
}

// Hilfsfunktion: Erstsprachunterricht-Satz generieren
function buildErstsprachunterrichtSatz(student: Record<string, unknown>): string {
  const erstsprach = student['Erstsprachunterricht'] as string || '';
  if (!erstsprach) return '';
  
  const vorname = student.Vorname as string || '';
  
  return `${vorname} hat am Erstsprachenunterricht „${erstsprach}" teilgenommen.`;
}

// Generiert ein einzelnes Deckblatt und gibt das XML zurück
function generateDeckblattXml(
  templateContent: string, 
  student: Record<string, unknown>
): string {
  const zip = new PizZip(templateContent);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '[', end: ']' }
  });

  const geschlecht = student.Geschlecht as string || '';
  const dieSchuelerIn = geschlecht === 'w' ? 'Die Schülerin' : 'Der Schüler';
  const stufe = student['Stufe 25/26'] || student['Stufe 26/27'] || '';
  const schulstufe = stufe ? String(stufe) : '';

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

  let docBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

  const schwerpunktSatz = buildSchwerpunktSatz(student);
  const hatSchwerpunkt = schwerpunktSatz.length > 0;
  const angeboteSatz = buildAngeboteSatz(student, hatSchwerpunkt);
  const leistungsniveauSatz = buildLeistungsniveauSatz(student);

  const generatedZip = new PizZip(docBuffer);
  let documentXml = generatedZip.file('word/document.xml')?.asText() || '';
  
  // Word teilt manchmal Text in mehrere w:t Elemente auf
  documentXml = documentXml.replace(
    /<w:t>#Erst<\/w:t>.*?<w:t>s<\/w:t>.*?<w:t>prachunterricht<\/w:t>/gs,
    '<w:t>#Erstsprachunterricht</w:t>'
  );
  
  if (schwerpunktSatz) {
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
  
  const stufeNum = Number(student['Stufe 25/26'] || 0);
  if (stufeNum >= 6 && leistungsniveauSatz) {
    documentXml = documentXml.replace(/#Leistungsniveau/g, leistungsniveauSatz);
  } else {
    documentXml = documentXml.replace(/#Leistungsniveau/g, '');
  }
  
  const erstsprachunterrichtSatz = buildErstsprachunterrichtSatz(student);
  if (erstsprachunterrichtSatz) {
    documentXml = documentXml.replace(/#Erstsprachunterricht/g, erstsprachunterrichtSatz);
  } else {
    documentXml = documentXml.replace(/#Erstsprachunterricht/g, '');
  }

  return documentXml;
}

// Extrahiert den Body-Inhalt aus document.xml
function extractBodyContent(documentXml: string): string {
  // Suche nach <w:body>...</w:body> und extrahiere den Inhalt
  const bodyMatch = documentXml.match(/<w:body>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) return '';
  
  let bodyContent = bodyMatch[1];
  
  // Entferne das abschließende w:sectPr (Section Properties) - das brauchen wir nur einmal am Ende
  bodyContent = bodyContent.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>\s*$/g, '');
  
  return bodyContent;
}

// Erstellt einen Seitenumbruch als XML
function createPageBreak(): string {
  return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
}

// GET /api/deckblatt-combined?klasse=...&schuljahr=...
// Generiert ein kombiniertes Word-Dokument mit allen Deckblättern einer Klasse
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

    // Alle Schüler der Klasse laden und nach Name sortieren
    const students = await col.find({ 
      [klasseFeld]: klasse, 
      _deleted: { $ne: true } 
    }).sort({ Familienname: 1, Vorname: 1 }).toArray();

    if (students.length === 0) {
      return NextResponse.json({ error: 'Keine Schüler in dieser Klasse gefunden' }, { status: 404 });
    }

    // Vorlage laden
    const templatePath = path.join(process.cwd(), 'public', 'Vorlagen', 'Deckblatt blau.docx');
    const templateContent = fs.readFileSync(templatePath, 'binary');

    // Erstes Dokument als Basis verwenden
    const firstStudentXml = generateDeckblattXml(templateContent, students[0] as unknown as Record<string, unknown>);
    
    // Basis-ZIP erstellen vom ersten Dokument
    const baseZip = new PizZip(templateContent);
    const baseDoc = new Docxtemplater(baseZip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '[', end: ']' }
    });
    
    // Render mit Dummy-Daten um die Struktur zu erhalten
    baseDoc.render({
      Vorname: '',
      Familienname: '',
      Geburtsdatum: '',
      Klasse: '',
      Stufe: '',
      Schulstufe: '',
      Benutzername: '',
      Geschlecht: '',
      Religion: '',
      'Die Schülerin': '',
    });
    
    const baseBuffer = baseDoc.getZip().generate({ type: 'nodebuffer' });
    const finalZip = new PizZip(baseBuffer);
    
    // Sammle alle Body-Inhalte
    const allBodies: string[] = [];
    
    for (let i = 0; i < students.length; i++) {
      const studentXml = generateDeckblattXml(templateContent, students[i] as unknown as Record<string, unknown>);
      const bodyContent = extractBodyContent(studentXml);
      
      if (i > 0) {
        // Seitenumbruch vor jedem Schüler außer dem ersten
        allBodies.push(createPageBreak());
      }
      allBodies.push(bodyContent);
    }
    
    // Hole das Original-sectPr vom ersten Dokument
    const firstDocXml = finalZip.file('word/document.xml')?.asText() || '';
    const sectPrMatch = firstDocXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
    const sectPr = sectPrMatch ? sectPrMatch[0] : '';
    
    // Erstelle neues document.xml mit allen Bodies
    const xmlHeader = firstDocXml.substring(0, firstDocXml.indexOf('<w:body>') + 8);
    const combinedXml = xmlHeader + allBodies.join('') + sectPr + '</w:body></w:document>';
    
    finalZip.file('word/document.xml', combinedXml);
    
    const finalBuffer = finalZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    // Klassenname für Dateiname bereinigen
    const klasseClean = klasse.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_');
    const filename = `Deckblaetter_${klasseClean}_Gesamt.docx`;

    return new NextResponse(new Uint8Array(finalBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Kombiniertes Dokument-Generierung fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Dokument-Generierung', details: String(error) },
      { status: 500 }
    );
  }
}
