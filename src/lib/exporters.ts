"use client";
import { utils, writeFile as writeXlsxFile, WorkBook } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, PageOrientation, BorderStyle } from 'docx';

// Zentrale Unicode-Säuberung / Normalisierung für PDF-Ausgaben
// Ziel: Entfernt problematische Steuer-/Unsichtbar-Zeichen, vereinheitlicht Sonderformen (Anführungen, Bindestriche, NBSP)
// und normalisiert Combining Marks via NFC.
export interface SanitizeOptions {
  maxLength?: number;           // optionaler Cut (z.B. für Karten)
  keepNewlines?: boolean;       // falls true, behalte echte Zeilenumbrüche vor dem Zusammenfassen von Whitespace
  debugTag?: string;            // wenn gesetzt und localStorage.pdfDebug==='1', werden entfernte Zeichen geloggt
}

const RE_REMOVE = /[\u0000-\u001F\u007F\u200B\u200C\u200D\u2060\uFEFF\u00AD\u202A-\u202E\u2066-\u2069]/g; // Steuer + Zero-Width + LRM/RLM etc.
const RE_VARIATION = /\uFE0E|\uFE0F/g; // Variation Selectors
// Mapping einzelner typographischer Varianten auf einfache ASCII-Form
const REPLACEMENTS: Record<string,string> = {
  '\u00A0': ' ', // NBSP
  '\u2009': ' ', // THIN SPACE
  '\u202F': ' ', // NARROW NBSP
  '\u2013': '-', // EN DASH
  '\u2014': '-', // EM DASH
  '\u2212': '-', // MINUS SIGN
  '\u2010': '-', // HYPHEN
  '\u2011': '-', // NON-BREAKING HYPHEN
  '\u2018': "'",
  '\u2019': "'",
  '\u201A': "'",
  '\u201B': "'",
  '\u2032': "'",
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u2033': '"',
  '\u2026': '...', // Ellipsis
};

export function sanitizeUnicode(input: unknown, opts?: SanitizeOptions) {
  if (input == null) return '';
  let s = String(input);
  const removedChars: Record<string, number> = {};
  // Normalisiere zu NFC (kombinierende Zeichen konsolidieren)
  try { s = s.normalize('NFC'); } catch {}
  // Ersetze bekannte Varianten
  s = s.replace(/[\u00A0\u2009\u202F\u2013\u2014\u2212\u2010\u2011\u2018\u2019\u201A\u201B\u2032\u201C\u201D\u201E\u2033\u2026]/g, ch => REPLACEMENTS[ch] || '');
  // Entferne Variation Selectors separat
  s = s.replace(RE_VARIATION, ch => { removedChars[ch] = (removedChars[ch]||0)+1; return ''; });
  // Entferne Steuer-/Zero-Width / Richtungszeichen
  s = s.replace(RE_REMOVE, ch => { removedChars[ch] = (removedChars[ch]||0)+1; return ''; });
  // Whitespace normalisieren (optional Newlines behalten)
  if (opts?.keepNewlines) {
    // Reduziere wiederholte Leerzeichen, aber erhalte Zeilenumbrüche
    s = s.replace(/[ \t\f\v]+/g,' ');
    // Übermäßige Leerzeilen auf eine reduzieren
    s = s.replace(/\n{3,}/g,'\n\n');
  } else {
    s = s.replace(/\s+/g,' ');
  }
  s = s.trim();
  if (opts?.maxLength && s.length > opts.maxLength) {
    s = s.slice(0, opts.maxLength - 1).trim() + '…';
  }
  if (opts?.debugTag && typeof window !== 'undefined') {
    try {
      if (window.localStorage.getItem('pdfDebug') === '1') {
        const keys = Object.keys(removedChars);
        if (keys.length) {
          // Log detailiert einmal pro Aufruf
            // eslint-disable-next-line no-console
          console.debug(`[PDF-Sanitize:${opts.debugTag}] entfernte Zeichen`, keys.map(k=>`U+${k.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')}(${JSON.stringify(k)}) x${removedChars[k]}`).join(', '));
        }
      }
    } catch {}
  }
  return s;
}

export interface ExportConfig {
  filenameBase: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  title?: string;
  word?: {
    orientation?: 'portrait' | 'landscape';
    headerBgColor?: string; // hex ohne # z.B. 'e5e5e5'
    zebra?: boolean;
    fontSize?: number; // pt
    headerFontSize?: number;
  };
}

export function exportExcel({ filenameBase, headers, rows, title }: ExportConfig) {
  const norm = rows.map(r => r.map(c => c == null ? '' : String(c)));
  const aoa: string[][] = [];
  if (title) aoa.push([title]);
  aoa.push(headers);
  aoa.push(...norm as string[][]);
  const ws = utils.aoa_to_sheet(aoa);
  // Wenn Titel vorhanden: Merge erste Zeile über Anzahl Spalten
  if (title) {
  // Bereichs-Info entfällt; wir nutzen nur merge über Spaltenanzahl
    (ws['!merges'] = ws['!merges'] || []).push({ s:{r:0,c:0}, e:{r:0,c:headers.length-1} });
    // Optionale leichte Formatierung (nicht alle Reader berücksichtigen Stil)
    const cell = ws['A1'] as unknown as { v: string; t: string; s?: unknown } | undefined;
    if (cell) {
      // Style Zuweisung: XLSX Typ nicht exakt typisiert -> bewusst auf unknown gecastet statt any
      (cell as { s?: { font?: { bold?: boolean } } }).s = { font: { bold: true } };
    }
  }
  const wb: WorkBook = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Daten');
  writeXlsxFile(wb, filenameBase + '.xlsx');
}

export async function exportPDF({ filenameBase, headers, rows, title }: ExportConfig) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const unicode = await ensureUnicodeFont(doc, true);
  const sanitize = (v: unknown) => sanitizeUnicode(v, { debugTag: 'table' });
  // Schrift setzen
  if (unicode) doc.setFont('NotoSans','normal'); else doc.setFont('helvetica','normal');
  let startY: number | undefined = undefined;
  if (title) {
    doc.setFontSize(14);
    if (unicode) doc.setFont('NotoSans','normal'); else doc.setFont('helvetica','bold');
    doc.text(sanitize(title), 14, 16);
    startY = 22;
    if (!unicode) doc.setFont('helvetica','normal'); // zurück
  }
  autoTable(doc, {
    startY,
    head: [headers.map(h => sanitize(h))],
    body: rows.map(r => r.map(c => sanitize(c))),
    styles: { font: unicode ? 'NotoSans' : 'helvetica', fontSize: 10 },
    headStyles: { fontStyle: unicode ? 'normal' : 'bold', font: unicode ? 'NotoSans' : 'helvetica' }
  });
  doc.save(filenameBase + '.pdf');
}

/*
  exportAccountsPDF
  Erzeugt eine PDF mit Zugangskarten (Rechtecke) für Schüler einer Klasse.
  Layout: A4 Landscape, 3 Spalten, dynamisch viele Zeilen, automatische Seitenumbrüche.
  Jeder Block zeigt: Vorname Familienname (fett), Benutzername, Passwort, optional Anton.
*/
export interface AccountCardStudent {
  Vorname?: string;
  Familienname?: string;
  Benutzername?: string;
  Passwort?: string;
  Anton?: string;
}

// Lädt optional eine Unicode-fähige Schrift (TTF) aus /fonts/NotoSans-Regular.ttf
interface JsPdfWithFlag extends jsPDF { _unicodeFontLoaded?: boolean }
async function ensureUnicodeFont(doc: jsPDF, preferUnicode?: boolean) {
  if (!preferUnicode) return false;
  const anyDoc = doc as JsPdfWithFlag;
  if (anyDoc._unicodeFontLoaded) {
    doc.setFont('NotoSans', 'normal');
    return true;
  }
  try {
    // Regular
    const loadFont = async (url: string, vfsName: string, family: string, style: string) => {
      const r = await fetch(url);
      if (!r.ok) return false;
      const buf = await r.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
      doc.addFileToVFS(vfsName, b64);
      doc.addFont(vfsName, family, style);
      return true;
    };
  const regularOk = await loadFont('/fonts/NotoSans-Regular.ttf','NotoSans-Regular.ttf','NotoSans','normal');
  if (!regularOk && typeof window !== 'undefined') {
    try { console.warn('[PDF] Warnung: NotoSans-Regular.ttf nicht gefunden – Akzentzeichen (^ ` ´) könnten falsch sein.'); } catch {}
  }
  // Bold-Datei absichtlich nicht automatisch geladen um 404 zu vermeiden, falls nicht vorhanden.
  // Falls später echte Bold-Unterstützung gewünscht ist, Datei NotoSans-Bold.ttf in /public/fonts legen
  // und folgenden Aufruf aktivieren:
  // await loadFont('/fonts/NotoSans-Bold.ttf','NotoSans-Bold.ttf','NotoSans','bold').catch(()=>false);
    if (!regularOk) return false;
    anyDoc._unicodeFontLoaded = true;
    doc.setFont('NotoSans','normal');
    return true;
  } catch (e) {
    if (typeof window !== 'undefined') {
      try { console.warn('[PDF] Unicode-Font Laden fehlgeschlagen', e); } catch {}
    }
    return false; }
}

export async function exportAccountsPDF(students: AccountCardStudent[], opts?: { filenameBase?: string; title?: string; columns?: number; gap?: number; margin?: number; cardHeight?: number; showAnton?: boolean; unicodeFont?: boolean; }) {
  const filenameBase = opts?.filenameBase || 'accounts';
  const title = opts?.title;
  const cols = Math.max(1, Math.min(opts?.columns || 3, 5));
  const gap = opts?.gap ?? 6; // mm zwischen Karten
  const margin = opts?.margin ?? 10; // Seitenrand mm
  const baseCardHeight = opts?.cardHeight ?? 40; // mm (kann wachsen wenn Anton vorhanden)
  const showAnton = opts?.showAnton ?? true;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const unicode = await ensureUnicodeFont(doc, opts?.unicodeFont);
  const sanitize = (v: string | undefined) => sanitizeUnicode(v, { maxLength: 120, debugTag: 'card' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;
  if (title) {
    doc.setFontSize(16);
    if (unicode) doc.setFont('NotoSans','normal'); else doc.setFont('helvetica','bold');
    doc.text(sanitize(title), pageW / 2, y, { align: 'center' });
    y += 8;
  }
  const usableW = pageW - margin * 2;
  const cardW = (usableW - gap * (cols - 1)) / cols;
  let x = margin;
  if (unicode) doc.setFont('NotoSans','normal'); else doc.setFont('helvetica','normal');
  doc.setFontSize(11);


  students.forEach((s, idx) => {
    const name = `${sanitize(s.Vorname)} ${sanitize(s.Familienname)}`.trim();
    const lines: { label?: string; value: string; bold?: boolean }[] = [];
    lines.push({ value: name, bold: true });
    if (s.Benutzername) lines.push({ label: 'Benutzer', value: s.Benutzername });
    if (s.Passwort) lines.push({ label: 'Passwort', value: s.Passwort });
    if (showAnton && s.Anton) lines.push({ label: 'Anton', value: s.Anton });
    // Berechne dynamische Höhe (ca. 6mm pro Zeile + Padding)
    const cardHeight = Math.max(baseCardHeight, 8 + lines.length * 6);
    // Seitenumbruch falls nötig
    if (y + cardHeight + margin > pageH) {
      doc.addPage('a4', 'landscape');
      y = margin;
      if (title) {
        doc.setFontSize(12);
        if (unicode) doc.setFont('NotoSans','normal'); else doc.setFont('helvetica','bold');
        doc.text(sanitize(title), pageW / 2, y, { align: 'center' });
        y += 6;
      }
      x = margin;
      doc.setFontSize(11);
      if (unicode) doc.setFont('NotoSans','normal'); else doc.setFont('helvetica','normal');
    }
    // Rahmen
    doc.setDrawColor(50);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardW, cardHeight, 2, 2);
    // Inhalt
    let cy = y + 6;
    lines.forEach(l => {
      const value = sanitize(l.value);
      if (l.bold) {
        if (unicode) {
          // Kein echtes Bold eingebettet? Dann leichte Simulation durch größeren Font kurz.
          doc.setFontSize(11.5);
          doc.text(value, x + 4, cy);
          doc.setFontSize(11);
        } else {
          doc.setFont('helvetica','bold');
          doc.text(value, x + 4, cy);
          doc.setFont('helvetica','normal');
        }
      } else {
        const text = l.label ? `${l.label}: ${sanitize(l.value)}` : value;
        doc.text(text, x + 4, cy);
      }
      cy += 6;
    });
    // Nächste Spalte
    const colIndex = (idx % cols);
    if (colIndex === cols - 1) {
      x = margin;
      y += cardHeight + gap;
    } else {
      x += cardW + gap;
    }
  });

  doc.save(filenameBase + '.pdf');
}

export async function exportWord({ filenameBase, headers, rows, title, word }: ExportConfig) {
  const opt = word || {};
  const fontSize = opt.fontSize ?? 10;
  const headerFontSize = opt.headerFontSize ?? fontSize + 1;
  const headerBg = opt.headerBgColor || 'd9d9d9';

  const tableRows: TableRow[] = [];
  // Header
  tableRows.push(new TableRow({ children: headers.map(h => new TableCell({
    shading: { fill: headerBg },
    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: headerFontSize * 2 })] })]
  })) }));
  // Body
  rows.forEach((r, idx) => {
    const zebra = opt.zebra && idx % 2 === 1;
    tableRows.push(new TableRow({ children: r.map(c => new TableCell({
      shading: zebra ? { fill: 'f5f5f5' } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text: String(c ?? ''), size: fontSize * 2 })] })]
    })) }));
  });
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'cccccc' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'cccccc' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'cccccc' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'cccccc' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'eeeeee' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'eeeeee' }
    }
  });

  const sectionChildren: (Paragraph | Table)[] = [];
  if (title) {
    sectionChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, size: (headerFontSize + 4) * 2, bold: true })] }));
  }
  sectionChildren.push(table);

  const doc = new Document({
    sections: [
      {
        properties: { page: { size: { orientation: opt.orientation === 'portrait' ? PageOrientation.PORTRAIT : PageOrientation.LANDSCAPE } } },
        children: sectionChildren
      }
    ]
  });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filenameBase + '.docx';
  a.click();
  URL.revokeObjectURL(a.href);
}
