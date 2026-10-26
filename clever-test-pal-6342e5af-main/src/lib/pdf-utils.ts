import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CandidateResult } from './calculations';
import { SUBJECTS } from './calculations';
import logoUrl from '@/assets/benin-coat.png';
import { examYear, getSchoolYear } from '@/lib/school-year';

// ---------- Logo cache ----------
let logoDataUrlPromise: Promise<string> | null = null;
function getLogoDataUrl(): Promise<string> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(logoUrl)
      .then(r => r.blob())
      .then(blob => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      }))
      .catch(() => '');
  }
  return logoDataUrlPromise;
}

// ---------- Shared options ----------
export type SignatureRole = 'center' | 'ccs' | 'school' | 'none';

export interface DocOptions {
  documentTitle: string;          // e.g. "Liste des candidats", "Statistique du centre"
  centerName?: string;            // Centre concerné
  effectif?: number | string;     // Effectif total
  signatureRole?: SignatureRole;  // Signature en bas à droite
}

// ---------- Header ----------
/**
 * Draws the official header following the user-specified layout:
 *  1. Top-left: logo + "Ministère des enseignements maternels et primaire" + tricolor bar + "République du Bénin"
 *  2. Top-right: 4 lines (République du Bénin / BP / Tél / email) right-aligned
 *  3. Full-width black horizontal line
 *  4. Big centered "EXAMENS BLANCS DÉPARTEMENTAL DU CEP 2026" + document name
 *  5. Centered info row: Circonscription / Centre / Effectif / Année scolaire
 *
 * Returns Y position (mm) where document body can start.
 */
async function drawOfficialHeader(doc: jsPDF, opts: DocOptions): Promise<number> {
  const pw = doc.internal.pageSize.getWidth();
  const leftX = 10;
  const rightX = pw - 10;
  const topY = 8;

  // ----- LEFT BLOCK (logo + ministère + tricolore + république) -----
  const logoSize = 16; // mm — defines the vertical envelope
  const logoData = await getLogoDataUrl();
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', leftX, topY, logoSize, logoSize); } catch { /* ignore */ }
  }

  // Text beside the logo — must fit exactly inside logoSize height
  const textX = leftX + logoSize + 1.5;
  // 3 lines ministère (~3mm each = 9mm) + tricolor bar (1.2mm + 0.8 padding) + "République du Bénin" (~3.5mm) = ~14.5mm <= 16mm
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  let ly = topY + 3;
  doc.text('Ministère', textX, ly);
  ly += 2.8;
  doc.text('des enseignements maternels', textX, ly);
  ly += 2.8;
  doc.text('et primaire', textX, ly);
  ly += 1.6;

  // Tricolor bar (green / yellow / red) — starts at the same X as the ministry text
  const ministryTextW = doc.getTextWidth('des enseignements maternels');
  const barW = ministryTextW;
  const barH = 1.4;
  const barX = textX;
  const barY = ly;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);
  doc.setFillColor(0, 135, 81);     // green
  doc.rect(barX, barY, barW / 3, barH, 'F');
  doc.setFillColor(252, 209, 22);   // yellow
  doc.rect(barX + barW / 3, barY, barW / 3, barH, 'F');
  doc.setFillColor(232, 17, 45);    // red
  doc.rect(barX + (2 * barW) / 3, barY, barW / 3, barH, 'F');

  ly = barY + barH + 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('République du Bénin', textX, ly);

  // ----- RIGHT BLOCK (4 lines, right-aligned, same vertical column) -----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  let ry = topY + 3;
  doc.text('République du Bénin', rightX, ry, { align: 'right' });
  ry += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('BP 20 Porto-Novo · Bénin', rightX, ry, { align: 'right' });
  ry += 3.5;
  doc.text('Tél : (+229) 20 21 52 22 / 20 21 32 64', rightX, ry, { align: 'right' });
  ry += 3.5;
  doc.text('contact@memp.gouv.bj', rightX, ry, { align: 'right' });

  // ----- Big black horizontal separator -----
  const lineY = Math.max(topY + logoSize, ry) + 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.9);
  doc.line(leftX, lineY, rightX, lineY);

  // ----- Big centered exam title -----
  let cy = lineY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(`EXAMEN BLANC DÉPARTEMENTAL DU CEP ${examYear()}`, pw / 2, cy, { align: 'center' });

  // Document name (sub-title)
  cy += 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.documentTitle, pw / 2, cy, { align: 'center' });

  // ----- Info row centered -----
  cy += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const centerName = opts.centerName ?? '—';
  const effectif = opts.effectif !== undefined && opts.effectif !== null ? String(opts.effectif) : '—';
  const infoLine = `Circonscription : Bantè      Centre : ${centerName}      Effectif : ${effectif}      Année scolaire : ${getSchoolYear()}`;
  doc.text(infoLine, pw / 2, cy, { align: 'center' });

  return cy + 4;
}

// ---------- Footer (credit on every page, signature on last page) ----------
function addFooterToAllPages(doc: jsPDF, signatureRole: SignatureRole = 'none') {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('Directed by Digit Solution 0167185948/0162145021', pw / 2, ph - 3, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  // Signature on the last page only, bottom-right
  if (signatureRole !== 'none') {
    doc.setPage(totalPages);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const label = signatureRole === 'ccs'
      ? 'Le Chef de la Circonscription Scolaire'
      : signatureRole === 'school'
        ? "L'Enseignant(e)"
        : 'Le Chef centre';
    const rightX = pw - 12;
    // "Fait à............ le ......... mai 2026" above the signature label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Fait à ............................. le ................. mai 2026', rightX, ph - 34, { align: 'right' });
    // Signature label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const labelY = ph - 28;
    doc.text(label, rightX, labelY, { align: 'right' });
    // signature line
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(rightX - 60, ph - 10, rightX, ph - 10);
  }
}

// ---------- Generators ----------

export async function generateCandidatesPdf(
  candidates: { numero_table?: string | null; nom: string; prenoms?: string | null; sexe?: string | null; ecole_provenance?: string | null; is_absent?: boolean | null }[],
  opts: DocOptions,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const effectif = opts.effectif ?? candidates.length;
  const headerY = await drawOfficialHeader(doc, { ...opts, effectif });

  const headers = ['N°', 'N° Table', 'Nom', 'Prénom(s)', 'Sexe', 'École', 'Statut'];
  const body = candidates.map((c, idx) => [
    String(idx + 1),
    c.numero_table ?? '',
    c.nom,
    c.prenoms ?? '',
    c.sexe ?? '',
    c.ecole_provenance ?? '',
    c.is_absent ? 'Absent' : 'Présent',
  ]);

  autoTable(doc, {
    head: [headers],
    body,
    startY: headerY,
    margin: { top: 5, right: 8, bottom: 18, left: 8 },
    styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', lineWidth: 0.2, lineColor: [0, 0, 0] },
    headStyles: { fillColor: [41, 65, 122], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
    bodyStyles: { lineWidth: 0.2, lineColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 35, fontStyle: 'bold' },
      3: { cellWidth: 45 },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 18, halign: 'center' },
    },
    theme: 'grid',
  });

  addFooterToAllPages(doc, opts.signatureRole ?? 'none');
  doc.save(`${opts.documentTitle}.pdf`);
}

export async function generateResultsPdf(
  results: CandidateResult[],
  opts: DocOptions,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const effectif = opts.effectif ?? results.length;
  const headerY = await drawOfficialHeader(doc, { ...opts, effectif });

  const headers = ['N°', 'Nom', 'Prénom(s)', 'Sexe', 'École', ...SUBJECTS.map(s => s.label), 'Total', 'Moy.', 'Rang', 'Seuil'];
  const body = results.map(r => [
    r.numero_table ?? '', r.nom, r.prenoms ?? '', r.sexe ?? '', r.ecole_provenance ?? '',
    ...SUBJECTS.map(s => r.notes ? ((r.notes as any)[s.key]?.toFixed(2) ?? '-') : '-'),
    r.total?.toFixed(2) ?? '-', r.moyenne?.toFixed(2) ?? '-', r.rang?.toString() ?? '-', r.seuilAtteint ? 'Oui' : 'Non',
  ]);

  autoTable(doc, {
    head: [headers], body, startY: headerY,
    margin: { top: 5, right: 3, bottom: 18, left: 3 },
    tableWidth: 'auto',
    styles: { fontSize: 5, cellPadding: 1, overflow: 'linebreak' },
    headStyles: { fillColor: [41, 65, 122], fontSize: 5 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 8 },
      4: { cellWidth: 25 },
      [5 + SUBJECTS.length]: { cellWidth: 12 },
      [5 + SUBJECTS.length + 1]: { cellWidth: 12 },
      [5 + SUBJECTS.length + 2]: { cellWidth: 10 },
      [5 + SUBJECTS.length + 3]: { cellWidth: 10 },
    },
    theme: 'grid',
  });
  addFooterToAllPages(doc, opts.signatureRole ?? 'none');
  doc.save(`${opts.documentTitle}.pdf`);
}

export async function generateCenterStatsPdf(
  tableData: { head: string[][]; body: string[][] },
  absentList: { numero_table: string; nom: string; prenoms: string; sexe: string; ecole: string }[],
  opts: DocOptions,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const headerY = await drawOfficialHeader(doc, opts);

  const categories = ['Inscrits', 'Présents', 'Absents', 'Abandon'];
  const head1 = [
    { content: 'École', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const, fillColor: [255, 255, 255] as [number, number, number], textColor: [0, 0, 0] as [number, number, number], fontStyle: 'bold' as const } },
    ...categories.map(c => ({ content: c, colSpan: 3, styles: { halign: 'center' as const, fillColor: [255, 255, 255] as [number, number, number], textColor: [0, 0, 0] as [number, number, number], fontStyle: 'bold' as const } })),
  ];
  const head2 = categories.flatMap(() => ['G', 'F', 'T']);

  autoTable(doc, {
    head: [head1, head2.map(h => ({ content: h, styles: { halign: 'center' as const, fillColor: [255, 255, 255] as [number, number, number], textColor: [0, 0, 0] as [number, number, number], fontSize: 7 } }))],
    body: tableData.body,
    startY: headerY,
    margin: { top: 5, right: 10, bottom: 18, left: 10 },
    styles: { fontSize: 7, cellPadding: 2, halign: 'center', lineWidth: 0.3, lineColor: [0, 0, 0] },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 7, lineWidth: 0.3, lineColor: [0, 0, 0] },
    bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
    columnStyles: { 0: { cellWidth: 35, halign: 'left', fontStyle: 'bold' } },
    theme: 'grid',
    didParseCell: (data) => {
      const row = data.row;
      const isLastRow = row.index === tableData.body.length - 1;
      if (isLastRow) data.cell.styles.fontStyle = 'bold';
      if (data.section === 'body' && [3, 6, 9, 12].includes(data.column.index)) {
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  if (absentList.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    const iconY = finalY + 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`LISTE DES ÉLÈVES ABSENTS (${absentList.length})`, pw / 2, iconY, { align: 'center' });

    autoTable(doc, {
      head: [[
        { content: 'N° Table', styles: { halign: 'center' as const, fillColor: [255, 255, 255] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] } },
        { content: 'Nom', styles: { halign: 'left' as const, fillColor: [255, 255, 255] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] } },
        { content: 'Prénom(s)', styles: { halign: 'left' as const, fillColor: [255, 255, 255] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] } },
        { content: 'École', styles: { halign: 'left' as const, fillColor: [255, 255, 255] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] } },
      ]],
      body: absentList.map(a => [a.numero_table, { content: a.nom, styles: { fontStyle: 'bold' as const } }, a.prenoms, a.ecole]),
      startY: iconY + 4,
      margin: { top: 5, right: 15, bottom: 18, left: 15 },
      styles: { fontSize: 8, cellPadding: 3, lineWidth: 0.3, lineColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 8, lineWidth: 0.3, lineColor: [0, 0, 0] },
      bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
      theme: 'grid',
    });
  }
  addFooterToAllPages(doc, opts.signatureRole ?? 'none');
  doc.save(`${opts.documentTitle}.pdf`);
}

export async function generateExamStatsPdf(
  tableData: { head: string[][]; body: string[][] },
  opts: DocOptions,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const headerY = await drawOfficialHeader(doc, opts);

  autoTable(doc, {
    head: tableData.head,
    body: tableData.body,
    startY: headerY,
    margin: { top: 5, right: 10, bottom: 18, left: 10 },
    styles: { fontSize: 9, cellPadding: 2.5, halign: 'center', valign: 'middle', lineWidth: 0.3, lineColor: [0, 0, 0], textColor: [0, 0, 0], fillColor: [255, 255, 255] },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9, lineWidth: 0.3, lineColor: [0, 0, 0], halign: 'center' },
    bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0], fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 'auto' } },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === tableData.body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  addFooterToAllPages(doc, opts.signatureRole ?? 'none');
  doc.save(`${opts.documentTitle}.pdf`);
}

// ---------- Générateurs génériques (espace École) ----------

export async function generateTablePdf(
  headers: string[],
  body: (string | number)[][],
  opts: DocOptions & { orientation?: 'portrait' | 'landscape' },
) {
  const doc = new jsPDF({ orientation: opts.orientation ?? 'portrait', unit: 'mm', format: 'a4' });
  const headerY = await drawOfficialHeader(doc, opts);

  autoTable(doc, {
    head: [headers],
    body: body.map(r => r.map(v => String(v))),
    startY: headerY,
    margin: { top: 5, right: 8, bottom: 18, left: 8 },
    styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', lineWidth: 0.2, lineColor: [0, 0, 0] },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, halign: 'center', lineWidth: 0.2, lineColor: [0, 0, 0] },
    bodyStyles: { lineWidth: 0.2, lineColor: [0, 0, 0] },
    theme: 'grid',
  });

  addFooterToAllPages(doc, opts.signatureRole ?? 'none');
  doc.save(`${opts.documentTitle}.pdf`);
}

export async function generateKeyValuePdf(
  rows: [string, string | number][],
  opts: DocOptions,
) {
  await generateTablePdf(['Rubrique', 'Valeur'], rows.map(([k, v]) => [k, v]), opts);
}
