import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:construction_material_mobile_app/core/theme/app_scroll_behavior.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/core/utils/report_export.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

/// Feature 10.14 — matches web Export Reports (5 report types + Excel/PDF).
class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  static const _adminTabs = <_ReportTab>[
    _ReportTab(
      id: 'monthlyProcurement',
      label: 'Monthly Procurement',
      icon: Icons.description_outlined,
      hintKey: 'procurementValue',
      moneyHint: true,
    ),
    _ReportTab(
      id: 'materialRequests',
      label: 'Material Requests',
      icon: Icons.assignment_outlined,
      hintKey: 'requestCount',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'projectBudget',
      label: 'Project Budget',
      icon: Icons.account_balance_wallet_outlined,
      hintKey: 'totalRemaining',
      moneyHint: true,
    ),
    _ReportTab(
      id: 'siteStock',
      label: 'Site Stock',
      icon: Icons.warehouse_outlined,
      hintKey: 'lineCount',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'supplierPayments',
      label: 'Supplier Payments',
      icon: Icons.payments_outlined,
      hintKey: 'totalPaid',
      moneyHint: true,
    ),
    _ReportTab(
      id: 'deliverySchedule',
      label: 'Delivery Schedule',
      icon: Icons.local_shipping_outlined,
      hintKey: 'deliveryCount',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'outstandingBalance',
      label: 'Outstanding Balance',
      icon: Icons.warning_amber_outlined,
      hintKey: 'totalOutstanding',
      moneyHint: true,
    ),
    _ReportTab(
      id: 'materialUsage',
      label: 'Material Usage',
      icon: Icons.inventory_2_outlined,
      hintKey: 'totalQtyOut',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'quotationBidding',
      label: 'Quotation & Bidding',
      icon: Icons.gavel_outlined,
      hintKey: 'bidCount',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'damagedMissing',
      label: 'Damaged & Missing',
      icon: Icons.report_problem_outlined,
      hintKey: 'issueCount',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'supplierPerformance',
      label: 'Supplier Performance',
      icon: Icons.emoji_events_outlined,
      hintKey: 'supplierCount',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'inventoryLedger',
      label: 'Inventory Ledger',
      icon: Icons.menu_book_outlined,
      hintKey: 'movementCount',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'taxSummary',
      label: 'Tax Summary',
      icon: Icons.receipt_long_outlined,
      hintKey: 'totalTax',
      moneyHint: true,
    ),
    _ReportTab(
      id: 'supplierDecline',
      label: 'Supplier Declines',
      icon: Icons.cancel_outlined,
      hintKey: 'declineCount',
      moneyHint: false,
    ),
  ];

  static const _pmTabs = <_ReportTab>[
    _ReportTab(
      id: 'myMaterialRequests',
      label: 'My Requests',
      icon: Icons.assignment_outlined,
      hintKey: 'requestCount',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'myProjectBudget',
      label: 'My Budget',
      icon: Icons.account_balance_wallet_outlined,
      hintKey: 'totalRemaining',
      moneyHint: true,
    ),
    _ReportTab(
      id: 'myDeliveries',
      label: 'My Deliveries',
      icon: Icons.local_shipping_outlined,
      hintKey: 'deliveryCount',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'myMaterialUsage',
      label: 'Site Usage',
      icon: Icons.inventory_2_outlined,
      hintKey: 'totalQtyOut',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'damagedMissing',
      label: 'Damaged & Missing',
      icon: Icons.report_problem_outlined,
      hintKey: 'issueCount',
      moneyHint: false,
    ),
  ];

  static const _accountantTabs = <_ReportTab>[
    _ReportTab(
      id: 'paymentSummary',
      label: 'Payments',
      icon: Icons.payments_outlined,
      hintKey: 'totalPaid',
      moneyHint: true,
    ),
    _ReportTab(
      id: 'outstandingBySupplier',
      label: 'Outstanding by Supplier',
      icon: Icons.warning_amber_outlined,
      hintKey: 'supplierCount',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'taxSummary',
      label: 'Tax Summary',
      icon: Icons.receipt_long_outlined,
      hintKey: 'totalTax',
      moneyHint: true,
    ),
    _ReportTab(
      id: 'poFinancials',
      label: 'PO Financials',
      icon: Icons.description_outlined,
      hintKey: 'poCount',
      moneyHint: false,
    ),
  ];

  static const _supplierTabs = <_ReportTab>[
    _ReportTab(
      id: 'myBids',
      label: 'My Bids',
      icon: Icons.request_quote_outlined,
      hintKey: 'pending',
      moneyHint: false,
    ),
    _ReportTab(
      id: 'myOrders',
      label: 'My POs',
      icon: Icons.description_outlined,
      hintKey: 'orderValue',
      moneyHint: true,
    ),
    _ReportTab(
      id: 'myPayments',
      label: 'Payments',
      icon: Icons.payments_outlined,
      hintKey: 'totalPaid',
      moneyHint: true,
    ),
    _ReportTab(
      id: 'outstandingBalance',
      label: 'Outstanding',
      icon: Icons.warning_amber_outlined,
      hintKey: 'totalOutstanding',
      moneyHint: true,
    ),
    _ReportTab(
      id: 'myPerformance',
      label: 'My Performance',
      icon: Icons.emoji_events_outlined,
      hintKey: 'completedOrders',
      moneyHint: false,
    ),
  ];

  Map<String, dynamic> _reports = {};
  Map<String, dynamic>? _charts;
  bool _loading = true;
  String? _error;
  String _activeId = 'monthlyProcurement';
  late String _month;
  String _dateMode = 'month';
  late String _fromDate;
  late String _toDate;
  String _periodLabel = '';
  bool _exporting = false;

  bool get _isSupplier =>
      ref.watch(authNotifierProvider).state.user?.role == 'Supplier';

  bool get _isPM =>
      ref.watch(authNotifierProvider).state.user?.role == 'Project Manager';

  bool get _isAccountant =>
      ref.watch(authNotifierProvider).state.user?.role == 'Accountant';

  List<_ReportTab> get _tabs {
    if (_isSupplier) return _supplierTabs;
    if (_isPM) return _pmTabs;
    if (_isAccountant) return _accountantTabs;
    return _adminTabs;
  }

  String get _defaultTabId {
    if (_isSupplier) return 'myBids';
    if (_isPM) return 'myMaterialRequests';
    if (_isAccountant) return 'paymentSummary';
    return 'monthlyProcurement';
  }

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = '${now.year}-${now.month.toString().padLeft(2, '0')}';
    _fromDate =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-01';
    _toDate = DateFormat('yyyy-MM-dd').format(now);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _activeId = _defaultTabId;
      _load();
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref.read(apiRepositoryProvider).getReports(
            month: _dateMode == 'month' ? _month : null,
            from: _dateMode == 'range' ? _fromDate : null,
            to: _dateMode == 'range' ? _toDate : null,
            supplierView: _isSupplier,
            pmView: _isPM,
            accountantView: _isAccountant,
          );
      final reports = data['reports'];
      final period = data['period'];
      if (mounted) {
        setState(() {
          _reports = reports is Map
              ? Map<String, dynamic>.from(reports)
              : <String, dynamic>{};
          final chartsRaw = data['charts'];
          _charts = chartsRaw is Map
              ? Map<String, dynamic>.from(chartsRaw)
              : null;
          if (period is Map) {
            _periodLabel = period['label']?.toString() ?? '';
          } else {
            _periodLabel = data['month']?.toString() ?? _month;
          }
          if (!_reports.containsKey(_activeId) && _tabs.isNotEmpty) {
            _activeId = _tabs.first.id;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, dynamic>? get _active {
    final raw = _reports[_activeId];
    if (raw is! Map) return null;
    return Map<String, dynamic>.from(raw);
  }

  List<String> _headers(Map<String, dynamic> report) {
    final h = report['headers'];
    if (h is! List) return const [];
    return h.map((e) => e.toString()).toList();
  }

  List<List<dynamic>> _rows(Map<String, dynamic> report) {
    final r = report['rows'];
    if (r is! List) return const [];
    return r.map((row) {
      if (row is! List) return <dynamic>[];
      return List<dynamic>.from(row);
    }).toList();
  }

  Future<void> _pickMonth() async {
    final parts = _month.split('-');
    final initial = DateTime(
      int.tryParse(parts[0]) ?? DateTime.now().year,
      int.tryParse(parts.length > 1 ? parts[1] : '') ?? DateTime.now().month,
    );
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      helpText: 'Pick any day in the report month',
    );
    if (picked == null) return;
    setState(() {
      _month = '${picked.year}-${picked.month.toString().padLeft(2, '0')}';
    });
    await _load();
  }

  Future<void> _pickFromDate() async {
    final initial = DateTime.tryParse(_fromDate) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime.tryParse(_toDate) ?? DateTime.now(),
      helpText: 'From date',
    );
    if (picked == null) return;
    setState(() {
      _fromDate = DateFormat('yyyy-MM-dd').format(picked);
    });
    await _load();
  }

  Future<void> _pickToDate() async {
    final initial = DateTime.tryParse(_toDate) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.tryParse(_fromDate) ?? DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      helpText: 'To date',
    );
    if (picked == null) return;
    setState(() {
      _toDate = DateFormat('yyyy-MM-dd').format(picked);
    });
    await _load();
  }

  String get _exportPeriod =>
      _periodLabel.isNotEmpty
          ? _periodLabel.replaceAll(' → ', '_')
          : (_dateMode == 'range' ? '${_fromDate}_$_toDate' : _month);

  Future<void> _exportExcel() async {
    final report = _active;
    if (report == null) return;
    final headers = _headers(report);
    final rows = _rows(report);
    if (headers.isEmpty) {
      _toast('No report data to export', error: true);
      return;
    }
    setState(() => _exporting = true);
    try {
      final day = DateFormat('yyyy-MM-dd').format(DateTime.now());
      await shareExcelReport(
        filename: '${_activeId}_${_exportPeriod}_$day.xlsx',
        sheetName: (report['title'] ?? 'Report').toString(),
        title: (report['title'] ?? 'Report').toString(),
        subtitle: (report['description'] ?? 'Period: $_exportPeriod').toString(),
        headers: headers,
        rows: rows,
      );
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _exportPdf() async {
    final report = _active;
    if (report == null) return;
    final headers = _headers(report);
    final rows = _rows(report);
    if (headers.isEmpty) {
      _toast('No report data to export', error: true);
      return;
    }
    setState(() => _exporting = true);
    try {
      final day = DateFormat('yyyy-MM-dd').format(DateTime.now());
      await sharePdfReport(
        filename: '${_activeId}_${_exportPeriod}_$day.pdf',
        title: (report['title'] ?? 'Report').toString(),
        subtitle: (report['description'] ?? 'Period: $_exportPeriod').toString(),
        headers: headers,
        rows: rows,
      );
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  List<ReportExportSheet> _collectExcelSheets() {
    final sheets = <ReportExportSheet>[];
    for (final t in _tabs) {
      final raw = _reports[t.id];
      if (raw is! Map) continue;
      final report = Map<String, dynamic>.from(raw);
      final headers = _headers(report);
      final rows = _rows(report);
      if (headers.isEmpty) continue;
      sheets.add(
        ReportExportSheet(
          sheetName: t.label,
          headers: headers,
          rows: rows,
          title: report['title']?.toString() ?? t.label,
          subtitle: report['description']?.toString() ?? 'Period: $_exportPeriod',
        ),
      );
    }
    return sheets;
  }

  List<ReportExportSection> _collectPdfSections() {
    final sections = <ReportExportSection>[];
    for (final t in _tabs) {
      final raw = _reports[t.id];
      if (raw is! Map) continue;
      final report = Map<String, dynamic>.from(raw);
      final headers = _headers(report);
      final rows = _rows(report);
      if (headers.isEmpty) continue;
      sections.add(
        ReportExportSection(
          title: report['title']?.toString() ?? t.label,
          subtitle: report['description']?.toString() ?? 'Period: $_exportPeriod',
          headers: headers,
          rows: rows,
        ),
      );
    }
    return sections;
  }

  Future<void> _exportAllExcel() async {
    final sheets = _collectExcelSheets();
    if (sheets.isEmpty) {
      _toast('No report data to export', error: true);
      return;
    }
    setState(() => _exporting = true);
    try {
      final day = DateFormat('yyyy-MM-dd').format(DateTime.now());
      await shareAllExcelReports(
        filename: 'all_reports_${_exportPeriod}_$day.xlsx',
        sheets: sheets,
        bundleTitle: 'All reports ($_exportPeriod)',
      );
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _exportAllPdf() async {
    final sections = _collectPdfSections();
    if (sections.isEmpty) {
      _toast('No report data to export', error: true);
      return;
    }
    setState(() => _exporting = true);
    try {
      final day = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final bundleTitle = _isSupplier
          ? 'My Activity — All Reports'
          : _isPM
              ? 'My Project Reports — All'
              : _isAccountant
                  ? 'Financial Reports — All'
                  : 'BuildFlow — All Reports';
      await shareAllPdfReports(
        filename: 'all_reports_${_exportPeriod}_$day.pdf',
        bundleTitle: bundleTitle,
        bundleSubtitle: 'Period: $_exportPeriod · ${sections.length} reports',
        sections: sections,
      );
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  void _toast(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error ? AppColors.danger : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingView(message: 'Loading reports…');
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    final dark = Theme.of(context).brightness == Brightness.dark;
    final report = _active;
    final headers = report != null ? _headers(report) : <String>[];
    final rows = report != null ? _rows(report) : <List<dynamic>>[];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: kAppScrollPhysics,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          Text(
            _isSupplier
                ? 'My Activity Report'
                : _isPM
                    ? 'My Project Reports'
                    : _isAccountant
                        ? 'Financial Reports'
                        : 'Export Reports',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            ' PDF / Excel — requests, budget, bidding, payments & more.',
            style: TextStyle(
              fontSize: 12.5,
              color: dark ? Colors.white70 : AppColors.textSecondary,
            ),
          ),
          if (_periodLabel.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Period: $_periodLabel',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              ),
            ),
          ],
          const SizedBox(height: 14),
          if (_charts != null) _ReportChartsSection(charts: _charts!, dark: dark),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              DropdownButton<String>(
                value: _dateMode,
                items: const [
                  DropdownMenuItem(value: 'month', child: Text('By month')),
                  DropdownMenuItem(value: 'range', child: Text('Custom range')),
                ],
                onChanged: (v) async {
                  if (v == null) return;
                  setState(() => _dateMode = v);
                  await _load();
                },
              ),
              if (_dateMode == 'month')
                OutlinedButton.icon(
                  onPressed: _pickMonth,
                  icon: const Icon(Icons.calendar_month_outlined, size: 18),
                  label: Text(_month),
                )
              else ...[
                OutlinedButton.icon(
                  onPressed: _pickFromDate,
                  icon: const Icon(Icons.date_range_outlined, size: 18),
                  label: Text('From $_fromDate'),
                ),
                OutlinedButton.icon(
                  onPressed: _pickToDate,
                  icon: const Icon(Icons.event_outlined, size: 18),
                  label: Text('To $_toDate'),
                ),
              ],
              ElevatedButton.icon(
                onPressed: _exporting ? null : _exportExcel,
                icon: const Icon(Icons.table_view_outlined, size: 18),
                label: const Text('Excel'),
              ),
              OutlinedButton.icon(
                onPressed: _exporting ? null : _exportPdf,
                icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
                label: const Text('PDF'),
              ),
              ElevatedButton.icon(
                onPressed: _exporting ? null : _exportAllExcel,
                icon: const Icon(Icons.file_download_outlined, size: 18),
                label: const Text('All Excel'),
              ),
              OutlinedButton.icon(
                onPressed: _exporting ? null : _exportAllPdf,
                icon: const Icon(Icons.folder_zip_outlined, size: 18),
                label: const Text('All PDF'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ..._tabs.map((t) {
            final r = _reports[t.id];
            final map = r is Map ? Map<String, dynamic>.from(r) : null;
            final count = map?['count'] ?? '—';
            final summary = map?['summary'] is Map
                ? Map<String, dynamic>.from(map!['summary'] as Map)
                : <String, dynamic>{};
            final hintVal = summary[t.hintKey];
            final hint = hintVal == null
                ? (map?['description']?.toString() ?? '—')
                : t.moneyHint
                ? 'Value: \$${NumberFormat('#,##0.##').format(num.tryParse('$hintVal') ?? 0)}'
                : '${t.hintKey}: $hintVal';
            final selected = _activeId == t.id;

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Material(
                color: selected
                    ? AppColors.primary.withValues(alpha: dark ? 0.22 : 0.08)
                    : (dark ? AppColors.darkCard : Colors.white),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radius),
                  side: BorderSide(
                    color: selected
                        ? AppColors.primary
                        : (dark ? AppColors.slate700 : AppColors.border),
                  ),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppTheme.radius),
                  onTap: () => setState(() => _activeId = t.id),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: selected
                                ? AppColors.primary
                                : AppColors.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            t.icon,
                            size: 20,
                            color: selected ? Colors.white : AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                t.label,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                hint,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: dark
                                      ? Colors.white54
                                      : AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          '$count',
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 20,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }),
          const SizedBox(height: 8),
          if (report != null) ...[
            Text(
              report['title']?.toString() ?? 'Report',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              report['description']?.toString() ?? '',
              style: TextStyle(
                fontSize: 12,
                color: dark ? Colors.white60 : AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),
            if (rows.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: Text('No rows for this period')),
              )
            else
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  headingRowHeight: 40,
                  dataRowMinHeight: 36,
                  dataRowMaxHeight: 48,
                  columnSpacing: 18,
                  columns: headers
                      .map(
                        (h) => DataColumn(
                          label: Text(
                            h,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 11,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  rows: rows.take(100).map((row) {
                    return DataRow(
                      cells: List.generate(headers.length, (i) {
                        final cell = i < row.length ? row[i] : '';
                        return DataCell(
                          Text(
                            formatReportCell(cell),
                            style: const TextStyle(fontSize: 11.5),
                          ),
                        );
                      }),
                    );
                  }).toList(),
                ),
              ),
            if (rows.length > 100)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Showing first 100 of ${rows.length} rows. Export for full file.',
                  style: TextStyle(
                    fontSize: 11,
                    color: dark ? Colors.white54 : AppColors.textSecondary,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _ReportChartsSection extends StatelessWidget {
  const _ReportChartsSection({required this.charts, required this.dark});

  final Map<String, dynamic> charts;
  final bool dark;

  List<Map<String, dynamic>> _series(String key) {
    final raw = charts[key];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .where((e) => e['label'] != null)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final stock = _series('stockMovement');
    final requests = _series('requestsByStatus');
    final budget = _series('budgetUsage');
    final declines = _series('declinesBySupplier');
    final payments = _series('paymentsByMethod');

    if (stock.isEmpty &&
        requests.isEmpty &&
        budget.isEmpty &&
        declines.isEmpty &&
        payments.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Charts',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
        ),
        const SizedBox(height: 10),
        if (stock.isNotEmpty)
          _SimpleBarCard(title: 'Stock In vs Out', data: stock, dark: dark),
        if (requests.isNotEmpty)
          _SimpleBarCard(title: 'Requests by status', data: requests, dark: dark),
        if (budget.isNotEmpty)
          _SimpleBarCard(title: 'Budget used vs remaining', data: budget, dark: dark),
        if (declines.isNotEmpty)
          _SimpleBarCard(title: 'Declines by supplier', data: declines, dark: dark),
        if (payments.isNotEmpty)
          _SimpleBarCard(title: 'Payments by method', data: payments, dark: dark),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _SimpleBarCard extends StatelessWidget {
  const _SimpleBarCard({
    required this.title,
    required this.data,
    required this.dark,
  });

  final String title;
  final List<Map<String, dynamic>> data;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final maxVal = data.fold<double>(0, (m, e) {
      final v = num.tryParse('${e['value']}')?.toDouble() ?? 0;
      return v > m ? v : m;
    });
    final maxY = maxVal <= 0 ? 1.0 : maxVal * 1.2;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      color: dark ? AppColors.darkCard : Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 12),
            SizedBox(
              height: 180,
              child: BarChart(
                BarChartData(
                  maxY: maxY,
                  gridData: FlGridData(show: true, drawVerticalLine: false),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 36,
                        getTitlesWidget: (v, _) => Text(
                          v >= 1000 ? '${(v / 1000).toStringAsFixed(0)}k' : v.toStringAsFixed(0),
                          style: const TextStyle(fontSize: 10),
                        ),
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (v, meta) {
                          final i = meta.appliedInterval == 0
                              ? v.toInt()
                              : v.toInt();
                          if (i < 0 || i >= data.length) return const SizedBox.shrink();
                          final label = data[i]['label']?.toString() ?? '';
                          return Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              label.length > 8 ? '${label.substring(0, 8)}…' : label,
                              style: const TextStyle(fontSize: 9),
                            ),
                          );
                        },
                      ),
                    ),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  ),
                  barGroups: List.generate(data.length, (i) {
                    final val = num.tryParse('${data[i]['value']}')?.toDouble() ?? 0;
                    return BarChartGroupData(
                      x: i,
                      barRods: [
                        BarChartRodData(
                          toY: val,
                          color: AppColors.primary,
                          width: 16,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                        ),
                      ],
                    );
                  }),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReportTab {
  final String id;
  final String label;
  final IconData icon;
  final String hintKey;
  final bool moneyHint;

  const _ReportTab({
    required this.id,
    required this.label,
    required this.icon,
    required this.hintKey,
    required this.moneyHint,
  });
}
