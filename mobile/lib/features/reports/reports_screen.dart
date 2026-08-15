import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
  ];

  Map<String, dynamic> _reports = {};
  bool _loading = true;
  String? _error;
  String _activeId = 'monthlyProcurement';
  late String _month;
  bool _exporting = false;

  bool get _isSupplier =>
      ref.watch(authNotifierProvider).state.user?.role == 'Supplier';

  List<_ReportTab> get _tabs => _isSupplier ? _supplierTabs : _adminTabs;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = '${now.year}-${now.month.toString().padLeft(2, '0')}';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_isSupplier) _activeId = 'myBids';
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
            month: _month,
            supplierView: _isSupplier,
          );
      final reports = data['reports'];
      if (mounted) {
        setState(() {
          _reports = reports is Map
              ? Map<String, dynamic>.from(reports)
              : <String, dynamic>{};
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
        filename: '${_activeId}_${_month}_$day.xlsx',
        sheetName: (report['title'] ?? 'Report').toString(),
        title: (report['title'] ?? 'Report').toString(),
        subtitle: (report['description'] ?? 'Period: $_month').toString(),
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
        filename: '${_activeId}_${_month}_$day.pdf',
        title: (report['title'] ?? 'Report').toString(),
        subtitle: (report['description'] ?? 'Period: $_month').toString(),
        headers: headers,
        rows: rows,
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
            _isSupplier ? 'My Activity Report' : 'Export Reports',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            ' PDF / Excel for procurement, payments, deliveries, outstanding & usage.',
            style: TextStyle(
              fontSize: 12.5,
              color: dark ? Colors.white70 : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: _pickMonth,
                icon: const Icon(Icons.calendar_month_outlined, size: 18),
                label: Text(_month),
              ),
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
