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
