"use client";
import { utils, writeFile as writeXlsxFile, WorkBook } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, PageOrientation, BorderStyle } from 'docx';

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

export function exportPDF({ filenameBase, headers, rows, title }: ExportConfig) {
  const doc = new jsPDF({ orientation: 'landscape' });
  let startY: number | undefined = undefined;
  if (title) {
    doc.setFontSize(14);
    doc.text(title, 14, 16);
    startY = 22;
  }
  autoTable(doc, { startY, head: [headers], body: rows.map(r=>r.map(c=> c==null ? '' : String(c))) });
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
    const res = await fetch('/fonts/NotoSans-Regular.ttf');
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    doc.addFileToVFS('NotoSans-Regular.ttf', b64);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  anyDoc._unicodeFontLoaded = true;
    doc.setFont('NotoSans', 'normal');
    return true;
  } catch { return false; }
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
  await ensureUnicodeFont(doc, opts?.unicodeFont);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;
  if (title) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageW / 2, y, { align: 'center' });
    y += 8;
  }
  const usableW = pageW - margin * 2;
  const cardW = (usableW - gap * (cols - 1)) / cols;
  let x = margin;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  students.forEach((s, idx) => {
    const name = `${s.Vorname || ''} ${s.Familienname || ''}`.trim();
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
        doc.setFont('helvetica', 'bold');
        doc.text(title, pageW / 2, y, { align: 'center' });
        y += 6;
      }
      x = margin;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
    }
    // Rahmen
    doc.setDrawColor(50);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardW, cardHeight, 2, 2);
    // Inhalt
    let cy = y + 6;
    lines.forEach(l => {
      if (l.bold) {
        doc.setFont('helvetica', 'bold');
        doc.text(l.value, x + 4, cy);
        doc.setFont('helvetica', 'normal');
      } else {
        const text = l.label ? `${l.label}: ${l.value}` : l.value;
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
