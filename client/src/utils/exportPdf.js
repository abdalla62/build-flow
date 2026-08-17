import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function cellText(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return v.toLocaleString();
  const s = String(v);
  // ISO dates from API
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
  }
  return s;
}

/**
 * Download a simple landscape PDF table report.
 */
export function downloadPdf(filename, title, headers, rows, subtitle = '') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  appendPdfSection(doc, title, headers, rows, subtitle, { isFirstPage: true });
  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(name);
}

function appendPdfSection(doc, title, headers, rows, subtitle = '', { isFirstPage = false } = {}) {
  if (!isFirstPage) doc.addPage('a4', 'landscape');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title || 'Report', 40, 36);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(String(subtitle), 40, 52);
    doc.setTextColor(0);
  }

  autoTable(doc, {
    startY: subtitle ? 64 : 48,
    head: [headers],
    body: rows.map((r) => r.map(cellText)),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 28, right: 28 }
  });
}

/**
 * One PDF file with every report as its own section/page.
 * @param {string} filename
 * @param {string} bundleTitle
 * @param {string} bundleSubtitle
 * @param {{ title: string, headers: string[], rows: any[][], subtitle?: string }[]} sections
 */
export function downloadPdfBundle(filename, bundleTitle, bundleSubtitle, sections) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  let first = true;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(bundleTitle || 'All Reports', 40, 40);
  if (bundleSubtitle) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(String(bundleSubtitle), 40, 58);
    doc.setTextColor(0);
  }
  first = false;

  for (const section of sections) {
    appendPdfSection(
      doc,
      section.title || 'Report',
      section.headers || [],
      section.rows || [],
      section.subtitle || '',
      { isFirstPage: false }
    );
  }

  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(name);
}
