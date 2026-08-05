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

  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(name);
}
