import 'dart:io';

import 'package:excel/excel.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

String formatReportCell(dynamic v) {
  if (v == null) return '';
  if (v is num) {
    if (v is int || v == v.roundToDouble()) return v.toString();
    return v.toStringAsFixed(2);
  }
  final s = v.toString();
  if (RegExp(r'^\d{4}-\d{2}-\d{2}T').hasMatch(s)) {
    final d = DateTime.tryParse(s);
    if (d != null) return DateFormat.yMd().format(d.toLocal());
  }
  return s;
}

Border get _thinBorder => Border(
      borderStyle: BorderStyle.Thin,
      borderColorHex: ExcelColor.fromHexString('FFCBD5E1'),
    );

CellStyle get _titleStyle => CellStyle(
      bold: true,
      fontSize: 16,
      fontColorHex: ExcelColor.fromHexString('FF0F172A'),
      horizontalAlign: HorizontalAlign.Left,
      verticalAlign: VerticalAlign.Center,
    );

CellStyle get _subtitleStyle => CellStyle(
      fontSize: 10,
      fontColorHex: ExcelColor.fromHexString('FF64748B'),
      horizontalAlign: HorizontalAlign.Left,
      verticalAlign: VerticalAlign.Center,
    );

CellStyle get _headerStyle => CellStyle(
      bold: true,
      fontSize: 11,
      fontColorHex: ExcelColor.white,
      backgroundColorHex: ExcelColor.fromHexString('FF0F766E'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
      leftBorder: _thinBorder,
      rightBorder: _thinBorder,
      topBorder: _thinBorder,
      bottomBorder: _thinBorder,
    );

CellStyle _dataStyle(bool zebra) => CellStyle(
      fontSize: 10,
      fontColorHex: ExcelColor.fromHexString('FF0F172A'),
      backgroundColorHex: zebra
          ? ExcelColor.fromHexString('FFF8FAFC')
          : ExcelColor.white,
      horizontalAlign: HorizontalAlign.Left,
      verticalAlign: VerticalAlign.Center,
      leftBorder: _thinBorder,
      rightBorder: _thinBorder,
      topBorder: _thinBorder,
      bottomBorder: _thinBorder,
    );

Future<void> shareExcelReport({
  required String filename,
  required String sheetName,
  required List<String> headers,
  required List<List<dynamic>> rows,
  String? title,
  String? subtitle,
}) async {
  final excel = Excel.createExcel();
  final safeName =
      sheetName.length > 31 ? sheetName.substring(0, 31) : sheetName;
  final defaultSheet = excel.getDefaultSheet();
  if (defaultSheet != null) {
    excel.rename(defaultSheet, safeName);
  }
  final sheet = excel[safeName];
  final colCount = headers.isEmpty ? 1 : headers.length;
  final reportTitle = (title ?? sheetName).trim();
  final reportSubtitle = (subtitle ?? '').trim();

  // Title row
  sheet.updateCell(
    CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 0),
    TextCellValue(reportTitle),
    cellStyle: _titleStyle,
  );
  // Subtitle row
  sheet.updateCell(
    CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 1),
    TextCellValue(reportSubtitle),
    cellStyle: _subtitleStyle,
  );

  if (colCount > 1) {
    sheet.merge(
      CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 0),
      CellIndex.indexByColumnRow(columnIndex: colCount - 1, rowIndex: 0),
    );
    sheet.merge(
      CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 1),
      CellIndex.indexByColumnRow(columnIndex: colCount - 1, rowIndex: 1),
    );
  }

  // Header row at index 3
  const headerRow = 3;
  for (var c = 0; c < headers.length; c++) {
    sheet.updateCell(
      CellIndex.indexByColumnRow(columnIndex: c, rowIndex: headerRow),
      TextCellValue(headers[c]),
      cellStyle: _headerStyle,
    );
  }

  // Data rows
  for (var r = 0; r < rows.length; r++) {
    final row = rows[r];
    final style = _dataStyle(r.isOdd);
    for (var c = 0; c < headers.length; c++) {
      final value = c < row.length ? formatReportCell(row[c]) : '';
      sheet.updateCell(
        CellIndex.indexByColumnRow(columnIndex: c, rowIndex: headerRow + 1 + r),
        TextCellValue(value),
        cellStyle: style,
      );
    }
  }

  // Column widths
  for (var c = 0; c < headers.length; c++) {
    var maxLen = headers[c].length;
    for (final row in rows) {
      final len = formatReportCell(c < row.length ? row[c] : '').length;
      if (len > maxLen) maxLen = len;
    }
    sheet.setColumnWidth(c, (maxLen + 4).clamp(12, 36).toDouble());
  }

  final bytes = excel.encode();
  if (bytes == null) throw Exception('Failed to encode Excel');

  final dir = await getTemporaryDirectory();
  final name = filename.endsWith('.xlsx') ? filename : '$filename.xlsx';
  final file = File('${dir.path}/$name');
  await file.writeAsBytes(bytes, flush: true);
  await SharePlus.instance.share(
    ShareParams(files: [XFile(file.path)], text: reportTitle),
  );
}

Future<void> sharePdfReport({
  required String filename,
  required String title,
  required String subtitle,
  required List<String> headers,
  required List<List<dynamic>> rows,
}) async {
  final doc = pw.Document();
  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4.landscape,
      margin: const pw.EdgeInsets.all(28),
      build: (context) => [
        pw.Text(
          title,
          style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold),
        ),
        if (subtitle.isNotEmpty) ...[
          pw.SizedBox(height: 4),
          pw.Text(
            subtitle,
            style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey700),
          ),
        ],
        pw.SizedBox(height: 12),
        pw.TableHelper.fromTextArray(
          headers: headers,
          data: rows.map((r) => r.map(formatReportCell).toList()).toList(),
          headerStyle: pw.TextStyle(
            fontWeight: pw.FontWeight.bold,
            color: PdfColors.white,
            fontSize: 8,
          ),
          headerDecoration:
              const pw.BoxDecoration(color: PdfColor.fromInt(0xFF0F766E)),
          cellStyle: const pw.TextStyle(fontSize: 7.5),
          cellAlignment: pw.Alignment.centerLeft,
          oddRowDecoration:
              const pw.BoxDecoration(color: PdfColor.fromInt(0xFFF8FAFC)),
          border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.4),
        ),
      ],
    ),
  );

  final bytes = await doc.save();
  final dir = await getTemporaryDirectory();
  final name = filename.endsWith('.pdf') ? filename : '$filename.pdf';
  final file = File('${dir.path}/$name');
  await file.writeAsBytes(bytes, flush: true);
  await SharePlus.instance.share(
    ShareParams(files: [XFile(file.path)], text: title),
  );
}
