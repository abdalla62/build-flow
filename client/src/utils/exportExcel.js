import * as XLSX from 'xlsx-js-style';

const TEAL = '0F766E';
const WHITE = 'FFFFFF';
const SLATE = '0F172A';
const MUTED = '64748B';
const ZEBRA = 'F8FAFC';
const BORDER = 'CBD5E1';

function cellText(v) {
  if (v == null || v === '') return '';
  return v;
}

function styleCell(value, style) {
  return { v: value == null ? '' : value, t: typeof value === 'number' ? 'n' : 's', s: style };
}

function createStyledWorksheet(headers, rows, meta = {}) {
  const title = meta.title || 'Report';
  const subtitle = meta.subtitle || '';
  const colCount = Math.max(headers.length, 1);
  const dataStartRow = 3;

  const aoa = [];
  aoa.push([title, ...Array(Math.max(0, colCount - 1)).fill('')]);
  aoa.push([subtitle, ...Array(Math.max(0, colCount - 1)).fill('')]);
  aoa.push(Array(colCount).fill(''));
  aoa.push(headers.map((h) => h ?? ''));
  for (const row of rows) {
    const padded = headers.map((_, i) => cellText(row?.[i]));
    aoa.push(padded);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  if (colCount > 1) {
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } }
    ];
  }

  const thin = { style: 'thin', color: { rgb: BORDER } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  const titleStyle = {
    font: { bold: true, sz: 16, color: { rgb: SLATE }, name: 'Calibri' },
    alignment: { vertical: 'center', horizontal: 'left' }
  };
  const subtitleStyle = {
    font: { sz: 10, color: { rgb: MUTED }, name: 'Calibri' },
    alignment: { vertical: 'center', horizontal: 'left' }
  };
  const headerStyle = {
    font: { bold: true, sz: 11, color: { rgb: WHITE }, name: 'Calibri' },
    fill: { patternType: 'solid', fgColor: { rgb: TEAL } },
    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
    border
  };
  const dataStyleEven = {
    font: { sz: 10, color: { rgb: SLATE }, name: 'Calibri' },
    fill: { patternType: 'solid', fgColor: { rgb: WHITE } },
    alignment: { vertical: 'center', horizontal: 'left' },
    border
  };
  const dataStyleOdd = {
    ...dataStyleEven,
    fill: { patternType: 'solid', fgColor: { rgb: ZEBRA } }
  };

  for (let c = 0; c < colCount; c++) {
    const titleRef = XLSX.utils.encode_cell({ r: 0, c });
    const subRef = XLSX.utils.encode_cell({ r: 1, c });
    if (worksheet[titleRef]) worksheet[titleRef].s = titleStyle;
    else if (c === 0) worksheet[titleRef] = styleCell(title, titleStyle);

    if (worksheet[subRef]) worksheet[subRef].s = subtitleStyle;
    else if (c === 0) worksheet[subRef] = styleCell(subtitle, subtitleStyle);

    const headerRef = XLSX.utils.encode_cell({ r: dataStartRow, c });
    if (worksheet[headerRef]) worksheet[headerRef].s = headerStyle;
  }

  for (let r = 0; r < rows.length; r++) {
    const style = r % 2 === 0 ? dataStyleEven : dataStyleOdd;
    for (let c = 0; c < colCount; c++) {
      const ref = XLSX.utils.encode_cell({ r: dataStartRow + 1 + r, c });
      if (!worksheet[ref]) {
        worksheet[ref] = styleCell('', style);
      } else {
        worksheet[ref].s = style;
        if (typeof worksheet[ref].v === 'string') worksheet[ref].t = 's';
      }
    }
  }

  worksheet['!cols'] = headers.map((header, colIndex) => {
    let maxLen = String(header || '').length;
    for (const row of rows) {
      const len = String(row?.[colIndex] ?? '').length;
      if (len > maxLen) maxLen = len;
    }
    maxLen = Math.max(maxLen, String(title).length / colCount, 10);
    return { wch: Math.min(42, Math.max(12, maxLen + 4)) };
  });

  worksheet['!rows'] = [
    { hpt: 26 },
    { hpt: 18 },
    { hpt: 8 },
    { hpt: 22 },
    ...rows.map(() => ({ hpt: 18 }))
  ];

  return worksheet;
}

/**
 * Styled Excel download matching PDF report look (teal header, title, zebra rows).
 * @param {string} filename
 * @param {string[]} headers
 * @param {(string|number)[][]} rows
 * @param {string} [sheetName='Report']
 * @param {{ title?: string, subtitle?: string }} [meta]
 */
export function downloadExcel(filename, headers, rows, sheetName = 'Report', meta = {}) {
  const title = meta.title || sheetName || 'Report';
  const worksheet = createStyledWorksheet(headers, rows, {
    title,
    subtitle: meta.subtitle || ''
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, String(sheetName).slice(0, 31));
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Multi-sheet Excel workbook — one tab per report.
 * @param {string} filename
 * @param {{ sheetName: string, headers: string[], rows: any[][], title?: string, subtitle?: string }[]} sheets
 */
export function downloadExcelWorkbook(filename, sheets) {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();

  for (const sheet of sheets) {
    let name = String(sheet.sheetName || sheet.title || 'Report').slice(0, 31);
    const base = name;
    let n = 2;
    while (usedNames.has(name)) {
      name = `${base.slice(0, 28)}_${n}`.slice(0, 31);
      n += 1;
    }
    usedNames.add(name);

    const worksheet = createStyledWorksheet(sheet.headers, sheet.rows, {
      title: sheet.title || name,
      subtitle: sheet.subtitle || ''
    });
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }

  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
