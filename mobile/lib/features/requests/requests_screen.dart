import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

List<Map<String, dynamic>> requestLines(Map<String, dynamic> r) {
  final raw = r['lines'];
  if (raw is List && raw.isNotEmpty) {
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  return [r];
}

double lineEstCost(Map<String, dynamic> r) {
  final qty = (r['quantity'] as num?)?.toDouble() ?? 0;
  final material = r['material'];
  final price = material is Map
      ? (material['estimatedPrice'] as num?)?.toDouble() ?? 0
      : 0;
  return qty * price;
}

String _moneyAmt(double v) {
  return NumberFormat.currency(symbol: '\$', decimalDigits: 2).format(v);
}

class _ProjectBudgetCounter extends StatelessWidget {
  final bool loading;
  final double? budget;
  final double usedWithThis;
  final double remaining;
  final double thisRequest;
  final bool exceeded;

  const _ProjectBudgetCounter({
    required this.loading,
    required this.budget,
    required this.usedWithThis,
    required this.remaining,
    required this.thisRequest,
    required this.exceeded,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: exceeded
            ? AppColors.danger.withValues(alpha: 0.08)
            : AppColors.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: exceeded ? AppColors.danger : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            loading ? 'PROJECT BUDGET COUNTER (loading…)' : 'PROJECT BUDGET COUNTER',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppColors.textSecondary,
              letterSpacing: 0.4,
            ),
          ),
          if (budget != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _mini('Total', _moneyAmt(budget!))),
                Expanded(child: _mini('Already used', _moneyAmt(usedWithThis))),
                Expanded(
                  child: _mini(
                    'Remaining',
                    _moneyAmt(remaining),
                    valueColor: remaining < 0 ? AppColors.danger : AppColors.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'This request (live)',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
                Text(
                  _moneyAmt(thisRequest),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ],
            ),
            if (exceeded) ...[
              const SizedBox(height: 8),
              const Text(
                'Xadkii waad dhaaftay — reduce quantity or remove materials.',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.danger,
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _mini(String label, String value, {Color? valueColor}) {
    return Column(
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w800,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: valueColor,
          ),
        ),
      ],
    );
  }
}

class RequestsScreen extends ConsumerStatefulWidget {
  const RequestsScreen({super.key});

  @override
  ConsumerState<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends ConsumerState<RequestsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiRepositoryProvider).getRequests(
            limit: 100,
            grouped: true,
          );
      if (mounted) setState(() => _items = res.items);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final projects = await ref.read(apiRepositoryProvider).getProjects(limit: 100);
    final materials = await ref.read(apiRepositoryProvider).getMaterials(limit: 100);
    if (projects.items.isEmpty || materials.items.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Need projects and materials first')),
        );
      }
      return;
    }

    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _CreateRequestDialog(
        projects: projects.items,
        materials: materials.items,
      ),
    );
    if (ok == true) _load();
  }

  Future<void> _openItem(Map<String, dynamic> item) async {
    final user = ref.read(authNotifierProvider).state.user;
    final role = user?.role;
    final id = (item['_id'] ?? item['id']).toString();
    final status = item['status']?.toString() ?? '';

    Map<String, dynamic>? detail;
    try {
      detail = await ref.read(apiRepositoryProvider).getRequest(id);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
      return;
    }

    final req = detail['request'] as Map<String, dynamic>;
    final approvals = (detail['approvals'] as List?)
            ?.map((e) => Map<String, dynamic>.from(e as Map))
            .toList() ??
        [];
    final canReview = (role == 'Project Manager' || role == 'Administrator') &&
        ['Pending', 'Returned', 'Rejected', 'Approved'].contains(status);

    final requesterId = popId(req['requestedBy']);
    // Server only allows the original Site Engineer requester to edit/resubmit
    final canEdit = role == 'Site Engineer' &&
        ['Pending', 'Returned'].contains(status) &&
        user?.id != null &&
        requesterId == user!.id;

    if (!mounted) return;

    if (canReview) {
      List<Map<String, dynamic>> suppliers = [];
      try {
        suppliers = await ref.read(apiRepositoryProvider).getAllSuppliers();
      } catch (_) {}

      if (!mounted) return;
      final posted = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => _ReviewRequestDialog(
          request: req,
          suppliers: suppliers,
          priorApprovals: approvals,
        ),
      );
      if (posted == true) _load();
      return;
    }

    // Detail (+ edit/resubmit for engineer, receive when delivered)
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          left: 16,
          right: 16,
          top: 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Request Detail', style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 12),
            Text('Project: ${popName(req['project'])}'),
            Text('Material: ${popName(req['material'])}'),
            Text('Qty: ${req['quantity']} Â· Priority: ${req['priority']}'),
            Text('Status: ${req['status']}'),
            Text('Reason: ${req['reason'] ?? 'â€”'}'),
            if (approvals.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Review history',
                style: Theme.of(ctx).textTheme.titleSmall,
              ),
              const SizedBox(height: 6),
              ...approvals.map((a) {
                final action = a['action']?.toString() ?? '';
                final comments = a['comments']?.toString() ?? '';
                final who = popName(a['approver']);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    '$action by $who: ${comments.isEmpty ? 'â€”' : comments}',
                    style: TextStyle(
                      fontSize: 13,
                      color: action == 'Return'
                          ? Colors.orange.shade700
                          : null,
                    ),
                  ),
                );
              }),
            ],
            _damageMissingSummary(req),
            const SizedBox(height: 16),
            if (canEdit) ...[
              ElevatedButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  final materials =
                      await ref.read(apiRepositoryProvider).getMaterials(limit: 100);
                  if (!mounted) return;
                  final saved = await showDialog<bool>(
                    context: context,
                    barrierDismissible: false,
                    builder: (_) => _EditRequestDialog(
                      request: req,
                      materials: materials.items,
                    ),
                  );
                  if (saved == true) _load();
                },
                icon: const Icon(Icons.edit_outlined),
                label: Text(
                  status == 'Returned' ? 'Revise & Resubmit' : 'Edit Request',
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await _cancel(id);
                },
                icon: const Icon(Icons.cancel_outlined, color: AppColors.danger),
                label: const Text(
                  'Cancel Request',
                  style: TextStyle(color: AppColors.danger),
                ),
              ),
            ],
            // Web: Confirm when Ordered + delivery marked Delivered (canConfirmReceipt)
            if ((role == 'Site Engineer' || role == 'Administrator') &&
                item['canConfirmReceipt'] == true) ...[
              const SizedBox(height: 8),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green.shade700,
                ),
                onPressed: () async {
                  Navigator.pop(ctx);
                  final ok = await showDialog<bool>(
                    context: context,
                    barrierDismissible: false,
                    builder: (_) => _ConfirmReceiptDialog(request: req),
                  );
                  if (ok == true) _load();
                },
                icon: const Icon(Icons.inventory_outlined),
                label: const Text('Confirm Receipt'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _damageMissingSummary(Map<String, dynamic> req) {
    final damaged = req['damagedReported'];
    final missing = req['missingReported'];
    final dQty = damaged is Map ? (damaged['quantity'] as num?)?.toInt() ?? 0 : 0;
    final mQty = missing is Map ? (missing['quantity'] as num?)?.toInt() ?? 0 : 0;
    if (dQty <= 0 && mQty <= 0) return const SizedBox.shrink();
    final unit = () {
      final m = req['material'];
      if (m is Map) return m['unit']?.toString() ?? 'units';
      return 'units';
    }();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (dQty > 0)
            Text(
              'Damaged: $dQty $unit â€” ${damaged is Map ? (damaged['comments'] ?? '') : ''}',
              style: TextStyle(color: Colors.orange.shade800, fontSize: 13),
            ),
          if (mQty > 0)
            Text(
              'Missing: $mQty $unit â€” ${missing is Map ? (missing['comments'] ?? '') : ''}',
              style: TextStyle(color: Colors.red.shade700, fontSize: 13),
            ),
        ],
      ),
    );
  }

  Future<void> _cancel(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel request?'),
        content: const Text(
          'Are you sure you want to cancel this request? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Yes, cancel'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ref.read(apiRepositoryProvider).cancelRequest(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Request cancelled')),
        );
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authNotifierProvider).state.user?.role;
    final canCreate = role == 'Site Engineer' || role == 'Administrator';

    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: _items.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: 240,
                    child: EmptyView(message: 'No material requests', onAction: _load),
                  ),
                ],
              )
            : ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(0, 8, 0, 88),
                itemCount: _items.length,
                itemBuilder: (_, i) {
                  final r = _items[i];
                  final status = r['status']?.toString() ?? '';
                  final canReview =
                      (role == 'Project Manager' || role == 'Administrator') &&
                          ['Pending', 'Returned', 'Rejected', 'Approved']
                              .contains(status);
                  final uid =
                      ref.watch(authNotifierProvider).state.user?.id ?? '';
                  final canResubmit = role == 'Site Engineer' &&
                      status == 'Returned' &&
                      popId(r['requestedBy']) == uid;
                  final canConfirm = (role == 'Site Engineer' ||
                          role == 'Administrator') &&
                      r['canConfirmReceipt'] == true;
                  final lines = requestLines(r);
                  final title = lines.length > 1
                      ? '${lines.length} materials'
                      : popName(r['material']);
                  final names = lines
                      .map((l) => popName(l['material']))
                      .where((n) => n != '—')
                      .take(2)
                      .join(', ');
                  final subtitle = lines.length > 1
                      ? '${popName(r['project'])} · $names'
                      : '${popName(r['project'])} · Qty ${r['quantity']}';
                  return ModuleListTile(
                    title: title,
                    subtitle: subtitle,
                    status: status,
                    icon: Icons.assignment_outlined,
                    onTap: () => _openItem(r),
                    trailing: canReview
                        ? TextButton(
                            onPressed: () => _openItem(r),
                            child: Text(
                              status == 'Approved' ? 'Update' : 'Review',
                            ),
                          )
                        : canConfirm
                            ? TextButton(
                                onPressed: () => _openItem(r),
                                child: const Text('Receive'),
                              )
                            : canResubmit
                                ? TextButton(
                                    onPressed: () => _openItem(r),
                                    child: const Text('Resubmit'),
                                  )
                                : null,
                  );
                },
              ),
      ),
      floatingActionButton: canCreate
          ? FloatingActionButton(
              onPressed: _create,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}

class _ReviewRequestDialog extends ConsumerStatefulWidget {
  final Map<String, dynamic> request;
  final List<Map<String, dynamic>> suppliers;
  final List<Map<String, dynamic>> priorApprovals;

  const _ReviewRequestDialog({
    required this.request,
    required this.suppliers,
    this.priorApprovals = const [],
  });

  @override
  ConsumerState<_ReviewRequestDialog> createState() => _ReviewRequestDialogState();
}

class _ReviewRequestDialogState extends ConsumerState<_ReviewRequestDialog> {
  final _commentsCtrl = TextEditingController();
  final _selectedSuppliers = <String>{};
  String _action = 'Approve';
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final status = widget.request['status']?.toString() ?? '';
    if (status == 'Approved') {
      _action = 'Return';
    }
    final existing = widget.request['suppliers'];
    if (existing is List) {
      for (final s in existing) {
        final id = popId(s);
        if (id.isNotEmpty) _selectedSuppliers.add(id);
      }
    }
  }

  @override
  void dispose() {
    _commentsCtrl.dispose();
    super.dispose();
  }

  double get _unitPrice {
    final material = widget.request['material'];
    if (material is Map) {
      return (material['estimatedPrice'] as num?)?.toDouble() ?? 0;
    }
    return 0;
  }

  double get _qty => (widget.request['quantity'] as num?)?.toDouble() ?? 0;

  double get _estimatedCost =>
      requestLines(widget.request).fold<double>(0, (sum, l) => sum + lineEstCost(l));

  double get _projectBudget {
    final project = widget.request['project'];
    if (project is Map) {
      return (project['budget'] as num?)?.toDouble() ?? 0;
    }
    return 0;
  }

  bool get _budgetWarning =>
      _projectBudget > 0 && _estimatedCost > _projectBudget * 0.20;

  String get _materialName => popName(widget.request['material']);
  String get _projectName => popName(widget.request['project']);
  String get _unit {
    final material = widget.request['material'];
    if (material is Map) return material['unit']?.toString() ?? 'units';
    return 'units';
  }

  String get _reason => widget.request['reason']?.toString() ?? 'â€”';

  String _money(double v) {
    return NumberFormat.currency(symbol: '\$', decimalDigits: 0).format(v);
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    final comments = _commentsCtrl.text.trim();
    if (comments.isEmpty) {
      setState(() => _error = 'Review comments/remarks are required');
      return;
    }
    if (_action == 'Approve' && _selectedSuppliers.isEmpty) {
      setState(
        () => _error = 'Select at least one supplier for quotations before approving',
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final id = (widget.request['_id'] ?? widget.request['id']).toString();
      await ref.read(apiRepositoryProvider).reviewRequest(
            id,
            action: _action,
            comments: comments,
            suppliers: _selectedSuppliers.toList(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Request successfully ${_action.toLowerCase()}d')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.request['status']?.toString() ?? '';
    final lineCount = requestLines(widget.request).length;
    final isUpdate = status == 'Approved';
    final title = isUpdate
        ? (lineCount > 1
            ? 'Update decision ($lineCount items)'
            : 'Update review decision')
        : (lineCount > 1
            ? 'Review Request ($lineCount items)'
            : 'Review Material Request');

    return AlertDialog(
      title: Text(title),
      content: SizedBox(
        width: 440,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppColors.danger.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],

              // Requested details
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'REQUESTED DETAILS',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textSecondary,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (requestLines(widget.request).length == 1)
                      Text(
                        '${_qty.toInt()} $_unit of $_materialName',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      )
                    else
                      ...requestLines(widget.request).map(
                        (line) {
                          final material = line['material'];
                          final unit = material is Map
                              ? material['unit']?.toString() ?? 'units'
                              : 'units';
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(
                              '${line['quantity']} $unit of ${popName(line['material'])}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          );
                        },
                      ),
                    const SizedBox(height: 4),
                    Text(
                      'Project: $_projectName | Reason: "$_reason"',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (widget.priorApprovals.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'PRIOR REVIEW COMMENTS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 6),
                ...widget.priorApprovals.map((a) {
                  final action = a['action']?.toString() ?? '';
                  final comments = a['comments']?.toString() ?? 'â€”';
                  final who = popName(a['approver']);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      '$action Â· $who: $comments',
                      style: TextStyle(
                        fontSize: 12,
                        color: action == 'Return'
                            ? Colors.orange.shade800
                            : AppColors.textSecondary,
                      ),
                    ),
                  );
                }),
              ],
              const SizedBox(height: 14),

              // Invite suppliers
              const Text(
                'INVITE SUPPLIERS (QUOTATIONS)',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textSecondary,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Select one or more suppliers who can submit quotation bids. Required when approving.',
                style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              Container(
                constraints: const BoxConstraints(maxHeight: 160),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: (_action == 'Approve' && _selectedSuppliers.isEmpty && _error != null)
                        ? AppColors.danger
                        : AppColors.border,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: widget.suppliers.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: Text(
                          'No suppliers available',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      )
                    : ListView(
                        shrinkWrap: true,
                        children: widget.suppliers.map((s) {
                          final id = popId(s);
                          final label = s['company']?.toString() ??
                              s['name']?.toString() ??
                              'Supplier';
                          return CheckboxListTile(
                            dense: true,
                            title: Text(label),
                            value: _selectedSuppliers.contains(id),
                            onChanged: _submitting
                                ? null
                                : (v) => setState(() {
                                      if (v == true) {
                                        _selectedSuppliers.add(id);
                                      } else {
                                        _selectedSuppliers.remove(id);
                                      }
                                    }),
                          );
                        }).toList(),
                      ),
              ),
              if (_selectedSuppliers.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    '${_selectedSuppliers.length} supplier${_selectedSuppliers.length > 1 ? 's' : ''} selected',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              const SizedBox(height: 14),

              // Budget cards
              Row(
                children: [
                  Expanded(
                    child: _BudgetCard(
                      label: 'ESTIMATED REQUEST COST',
                      value: _money(_estimatedCost),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _BudgetCard(
                      label: 'PROJECT BUDGET',
                      value: _money(_projectBudget),
                    ),
                  ),
                ],
              ),
              if (_budgetWarning) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppColors.danger.withValues(alpha: 0.35),
                    ),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.warning_amber_rounded, color: AppColors.danger, size: 20),
                      SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'BUDGET WARNING ALERT',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: AppColors.danger,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'The requested cost exceeds 20% of the project\'s total designated budget. Ensure sufficient contingency exists before approval.',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.danger,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 14),

              DropdownButtonFormField<String>(
                value: _action,
                items: const [
                  DropdownMenuItem(value: 'Approve', child: Text('Approve')),
                  DropdownMenuItem(value: 'Return', child: Text('Return')),
                  DropdownMenuItem(value: 'Reject', child: Text('Reject')),
                ],
                onChanged: _submitting
                    ? null
                    : (v) {
                        if (v == null) return;
                        setState(() => _action = v);
                      },
                decoration: const InputDecoration(labelText: 'Review Action'),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _commentsCtrl,
                enabled: !_submitting,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Remarks / Justification Comments',
                  hintText:
                      'Include details about budget approval status or reason for returningâ€¦',
                  alignLabelWithHint: true,
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text(isUpdate ? 'Update decision' : 'Post Review Decision'),
        ),
      ],
    );
  }
}

class _BudgetCard extends StatelessWidget {
  final String label;
  final String value;

  const _BudgetCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: AppColors.textSecondary,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

/// Multi-line create (same as web): one batch, live budget counter.
class _CreateRequestDialog extends ConsumerStatefulWidget {
  final List<Map<String, dynamic>> projects;
  final List<Map<String, dynamic>> materials;

  const _CreateRequestDialog({
    required this.projects,
    required this.materials,
  });

  @override
  ConsumerState<_CreateRequestDialog> createState() =>
      _CreateRequestDialogState();
}

class _CreateRequestDialogState extends ConsumerState<_CreateRequestDialog> {
  final _reasonCtrl = TextEditingController();
  late final TextEditingController _dateCtrl;
  String? _projectId;
  String _priority = 'Medium';
  final _lines = <({String materialId, int quantity})>[];
  bool _submitting = false;
  String? _error;
  bool _budgetLoading = false;
  double? _budgetTotal;
  double _budgetUsed = 0;

  @override
  void initState() {
    super.initState();
    _projectId = popId(widget.projects.first);
    _dateCtrl = TextEditingController(
      text: DateFormat('yyyy-MM-dd')
          .format(DateTime.now().add(const Duration(days: 7))),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadBudget());
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    _dateCtrl.dispose();
    super.dispose();
  }

  double _priceOf(String materialId) {
    final m = widget.materials.firstWhere(
      (e) => popId(e) == materialId,
      orElse: () => <String, dynamic>{},
    );
    return (m['estimatedPrice'] as num?)?.toDouble() ?? 0;
  }

  String _nameOf(String materialId) {
    final m = widget.materials.firstWhere(
      (e) => popId(e) == materialId,
      orElse: () => <String, dynamic>{},
    );
    return m['name']?.toString() ?? 'Material';
  }

  String _unitOf(String materialId) {
    final m = widget.materials.firstWhere(
      (e) => popId(e) == materialId,
      orElse: () => <String, dynamic>{},
    );
    return m['unit']?.toString() ?? 'units';
  }

  double get _estTotal => _lines.fold<double>(
        0,
        (sum, l) => sum + l.quantity * _priceOf(l.materialId),
      );

  double get _liveRemaining =>
      (_budgetTotal ?? 0) - _budgetUsed - _estTotal;

  bool get _budgetExceeded =>
      _budgetTotal != null && _estTotal > 0 && _liveRemaining < -0.009;

  Future<void> _loadBudget() async {
    final id = _projectId;
    if (id == null || id.isEmpty) {
      setState(() {
        _budgetTotal = null;
        _budgetUsed = 0;
      });
      return;
    }
    setState(() => _budgetLoading = true);
    try {
      final b = await ref.read(apiRepositoryProvider).getProjectBudget(id);
      if (!mounted) return;
      setState(() {
        _budgetTotal = (b['budget'] as num?)?.toDouble() ?? 0;
        _budgetUsed = (b['used'] as num?)?.toDouble() ?? 0;
        _budgetLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _budgetLoading = false);
    }
  }

  void _addMaterial(String? id) {
    if (id == null || id.isEmpty) return;
    if (_lines.any((l) => l.materialId == id)) return;
    setState(() => _lines.add((materialId: id, quantity: 1)));
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    if (_projectId == null || _projectId!.isEmpty) {
      setState(() => _error = 'Select a project');
      return;
    }
    if (_lines.isEmpty) {
      setState(() => _error = 'Add at least one material line');
      return;
    }
    if (_reasonCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Reason is required');
      return;
    }
    if (_dateCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Required date is required');
      return;
    }
    if (_budgetExceeded) {
      setState(() => _error = 'Xadkii waad dhaaftay — budget limit exceeded');
      return;
    }

    setState(() => _submitting = true);
    try {
      final api = ref.read(apiRepositoryProvider);
      await api.createRequestBatch({
        'project': _projectId,
        'priority': _priority,
        'reason': _reasonCtrl.text.trim(),
        'requiredDate': _dateCtrl.text.trim(),
        'lines': _lines
            .map(
              (line) => {
                'material': line.materialId,
                'quantity': line.quantity,
              },
            )
            .toList(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _lines.length == 1
                ? 'Material request submitted'
                : 'Material request submitted (${_lines.length} items)',
          ),
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final available = widget.materials
        .where((m) => !_lines.any((l) => l.materialId == popId(m)))
        .toList();

    return AlertDialog(
      title: const Text('New Material Request'),
      content: SizedBox(
        width: 440,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null) ...[
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
                const SizedBox(height: 8),
              ],
              DropdownButtonFormField<String>(
                initialValue: _projectId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Project'),
                items: widget.projects
                    .map(
                      (p) => DropdownMenuItem(
                        value: popId(p),
                        child: Text(
                          p['name']?.toString() ?? '',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: _submitting
                    ? null
                    : (v) {
                        setState(() => _projectId = v);
                        _loadBudget();
                      },
              ),
              if (_projectId != null && _projectId!.isNotEmpty) ...[
                const SizedBox(height: 12),
                _ProjectBudgetCounter(
                  loading: _budgetLoading,
                  budget: _budgetTotal,
                  usedWithThis: _budgetUsed + _estTotal,
                  remaining: _liveRemaining,
                  thisRequest: _estTotal,
                  exceeded: _budgetExceeded,
                ),
              ],
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: ValueKey(available.length),
                initialValue: null,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Add material line',
                  helperText: 'Select materials one by one (multi-line)',
                ),
                hint: const Text('Select Material'),
                items: available
                    .map(
                      (m) => DropdownMenuItem(
                        value: popId(m),
                        child: Text(
                          m['name']?.toString() ?? '',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: _submitting ? null : _addMaterial,
              ),
              if (_lines.isNotEmpty) ...[
                const SizedBox(height: 10),
                ..._lines.map((line) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.border),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _nameOf(line.materialId),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  '${_unitOf(line.materialId)} Â· \$${_priceOf(line.materialId).toStringAsFixed(0)}/unit',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: _submitting || line.quantity <= 1
                                ? null
                                : () => setState(() {
                                      final i = _lines.indexOf(line);
                                      _lines[i] = (
                                        materialId: line.materialId,
                                        quantity: line.quantity - 1,
                                      );
                                    }),
                            icon: const Icon(Icons.remove_circle_outline),
                          ),
                          Text(
                            '${line.quantity}',
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          IconButton(
                            onPressed: _submitting
                                ? null
                                : () => setState(() {
                                      final i = _lines.indexOf(line);
                                      _lines[i] = (
                                        materialId: line.materialId,
                                        quantity: line.quantity + 1,
                                      );
                                    }),
                            icon: const Icon(Icons.add_circle_outline),
                          ),
                          IconButton(
                            onPressed: _submitting
                                ? null
                                : () => setState(() => _lines.remove(line)),
                            icon: const Icon(Icons.close, color: AppColors.danger),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                if (_estTotal > 0)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      '${_lines.length} item${_lines.length > 1 ? 's' : ''} Â· Est. Total: \$${_estTotal.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
              ],
              DropdownButtonFormField<String>(
                initialValue: _priority,
                decoration: const InputDecoration(labelText: 'Priority'),
                items: ['Low', 'Medium', 'High', 'Urgent']
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: _submitting
                    ? null
                    : (v) => setState(() => _priority = v ?? _priority),
              ),
              TextField(
                controller: _dateCtrl,
                enabled: !_submitting,
                decoration: const InputDecoration(
                  labelText: 'Required Date (yyyy-MM-dd)',
                ),
              ),
              TextField(
                controller: _reasonCtrl,
                enabled: !_submitting,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Reason'),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: (_submitting || _budgetExceeded) ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(_budgetExceeded ? 'Xadkii waad dhaaftay' : 'Submit'),
        ),
      ],
    );
  }
}

/// Single-line revise & resubmit for Returned / Pending requests.
class _EditRequestDialog extends ConsumerStatefulWidget {
  final Map<String, dynamic> request;
  final List<Map<String, dynamic>> materials;

  const _EditRequestDialog({
    required this.request,
    required this.materials,
  });

  @override
  ConsumerState<_EditRequestDialog> createState() => _EditRequestDialogState();
}

class _EditRequestDialogState extends ConsumerState<_EditRequestDialog> {
  late String _materialId;
  late final TextEditingController _qtyCtrl;
  late final TextEditingController _reasonCtrl;
  late final TextEditingController _dateCtrl;
  late String _priority;
  bool _submitting = false;
  String? _error;
  bool _budgetLoading = false;
  double? _budgetTotal;
  double _budgetUsed = 0;

  @override
  void initState() {
    super.initState();
    _materialId = popId(widget.request['material']);
    if (_materialId.isEmpty && widget.materials.isNotEmpty) {
      _materialId = popId(widget.materials.first);
    }
    _qtyCtrl = TextEditingController(
      text: '${widget.request['quantity'] ?? 1}',
    );
    _reasonCtrl = TextEditingController(
      text: widget.request['reason']?.toString() ?? '',
    );
    _priority = widget.request['priority']?.toString() ?? 'Medium';
    final rawDate = widget.request['requiredDate']?.toString() ?? '';
    final ymd = rawDate.contains('T') ? rawDate.split('T').first : rawDate;
    _dateCtrl = TextEditingController(
      text: ymd.isNotEmpty
          ? ymd
          : DateFormat('yyyy-MM-dd')
              .format(DateTime.now().add(const Duration(days: 7))),
    );
    _qtyCtrl.addListener(() {
      if (mounted) setState(() {});
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadBudget());
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _reasonCtrl.dispose();
    _dateCtrl.dispose();
    super.dispose();
  }

  double _priceOf(String materialId) {
    final m = widget.materials.firstWhere(
      (e) => popId(e) == materialId,
      orElse: () => <String, dynamic>{},
    );
    return (m['estimatedPrice'] as num?)?.toDouble() ?? 0;
  }

  double get _priorCost => lineEstCost(widget.request);

  double get _editCost {
    final qty = int.tryParse(_qtyCtrl.text.trim()) ?? 0;
    return qty * _priceOf(_materialId);
  }

  double get _liveUsedBase {
    final v = _budgetUsed - _priorCost;
    return v < 0 ? 0 : v;
  }

  double get _liveRemaining =>
      (_budgetTotal ?? 0) - _liveUsedBase - _editCost;

  bool get _budgetExceeded =>
      _budgetTotal != null && _editCost > 0 && _liveRemaining < -0.009;

  Future<void> _loadBudget() async {
    final projectId = popId(widget.request['project']);
    if (projectId.isEmpty) return;
    setState(() => _budgetLoading = true);
    try {
      final b = await ref.read(apiRepositoryProvider).getProjectBudget(projectId);
      if (!mounted) return;
      setState(() {
        _budgetTotal = (b['budget'] as num?)?.toDouble() ?? 0;
        _budgetUsed = (b['used'] as num?)?.toDouble() ?? 0;
        _budgetLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _budgetLoading = false);
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    final qty = int.tryParse(_qtyCtrl.text.trim()) ?? 0;
    if (qty < 1) {
      setState(() => _error = 'Quantity must be at least 1');
      return;
    }
    if (_reasonCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Reason is required');
      return;
    }
    if (_budgetExceeded) {
      setState(() => _error = 'Xadkii waad dhaaftay — budget limit exceeded');
      return;
    }

    setState(() => _submitting = true);
    try {
      final id =
          (widget.request['_id'] ?? widget.request['id']).toString();
      await ref.read(apiRepositoryProvider).updateRequest(id, {
        'project': popId(widget.request['project']),
        'material': _materialId,
        'quantity': qty,
        'priority': _priority,
        'reason': _reasonCtrl.text.trim(),
        'requiredDate': _dateCtrl.text.trim(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Request revised and resubmitted')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isReturned = widget.request['status']?.toString() == 'Returned';
    return AlertDialog(
      title: Text(isReturned ? 'Revise & Resubmit' : 'Edit Request'),
      content: SizedBox(
        width: 400,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_error != null) ...[
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
                const SizedBox(height: 8),
              ],
              _ProjectBudgetCounter(
                loading: _budgetLoading,
                budget: _budgetTotal,
                usedWithThis: _liveUsedBase + _editCost,
                remaining: _liveRemaining,
                thisRequest: _editCost,
                exceeded: _budgetExceeded,
              ),
              const SizedBox(height: 12),
              if (isReturned)
                const Padding(
                  padding: EdgeInsets.only(bottom: 10),
                  child: Text(
                    'Update the request after PM Return comments, then resubmit (status â†’ Pending).',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ),
              DropdownButtonFormField<String>(
                initialValue: _materialId.isEmpty ? null : _materialId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Material'),
                items: widget.materials
                    .map(
                      (m) => DropdownMenuItem(
                        value: popId(m),
                        child: Text(
                          m['name']?.toString() ?? '',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: _submitting
                    ? null
                    : (v) => setState(() => _materialId = v ?? _materialId),
              ),
              TextField(
                controller: _qtyCtrl,
                enabled: !_submitting,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Quantity'),
              ),
              DropdownButtonFormField<String>(
                initialValue: _priority,
                decoration: const InputDecoration(labelText: 'Priority'),
                items: ['Low', 'Medium', 'High', 'Urgent']
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: _submitting
                    ? null
                    : (v) => setState(() => _priority = v ?? _priority),
              ),
              TextField(
                controller: _dateCtrl,
                enabled: !_submitting,
                decoration: const InputDecoration(
                  labelText: 'Required Date (yyyy-MM-dd)',
                ),
              ),
              TextField(
                controller: _reasonCtrl,
                enabled: !_submitting,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Reason'),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: (_submitting || _budgetExceeded) ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(
                  _budgetExceeded
                      ? 'Xadkii waad dhaaftay'
                      : (isReturned ? 'Resubmit' : 'Save'),
                ),
        ),
      ],
    );
  }
}

/// Confirm on-site receipt â€” report damaged / missing (matches web).
class _ConfirmReceiptDialog extends ConsumerStatefulWidget {
  final Map<String, dynamic> request;

  const _ConfirmReceiptDialog({required this.request});

  @override
  ConsumerState<_ConfirmReceiptDialog> createState() =>
      _ConfirmReceiptDialogState();
}

class _ConfirmReceiptDialogState extends ConsumerState<_ConfirmReceiptDialog> {
  final _damagedCtrl = TextEditingController(text: '0');
  final _missingCtrl = TextEditingController(text: '0');
  final _damagedCommentsCtrl = TextEditingController();
  final _missingCommentsCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;

  int get _totalQty =>
      (widget.request['quantity'] as num?)?.toInt() ?? 0;

  String get _unit {
    final m = widget.request['material'];
    if (m is Map) return m['unit']?.toString() ?? 'units';
    return 'units';
  }

  @override
  void dispose() {
    _damagedCtrl.dispose();
    _missingCtrl.dispose();
    _damagedCommentsCtrl.dispose();
    _missingCommentsCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    final damaged = int.tryParse(_damagedCtrl.text.trim()) ?? 0;
    final missing = int.tryParse(_missingCtrl.text.trim()) ?? 0;
    if (damaged < 0 || missing < 0) {
      setState(() => _error = 'Quantities cannot be negative');
      return;
    }
    if (damaged + missing > _totalQty) {
      setState(
        () => _error = 'Damaged + missing cannot exceed $_totalQty $_unit',
      );
      return;
    }
    if (damaged > 0 && _damagedCommentsCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Describe the damaged stock');
      return;
    }
    if (missing > 0 && _missingCommentsCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Describe what is missing');
      return;
    }

    setState(() => _submitting = true);
    try {
      final id =
          (widget.request['_id'] ?? widget.request['id']).toString();
      await ref.read(apiRepositoryProvider).receiveRequest(
            id,
            damagedQuantity: damaged,
            missingQuantity: missing,
            damagedComments: _damagedCommentsCtrl.text.trim(),
            missingComments: _missingCommentsCtrl.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Receipt confirmed')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Confirm Receipt'),
      content: SizedBox(
        width: 400,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Confirm quantities received on site after delivery. Report damaged or missing items if any.\n\n'
                'Ordered: $_totalQty $_unit of ${popName(widget.request['material'])}',
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              const SizedBox(height: 12),
              TextField(
                controller: _damagedCtrl,
                enabled: !_submitting,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Damaged quantity ($_unit)',
                ),
                onChanged: (_) => setState(() {}),
              ),
              TextField(
                controller: _missingCtrl,
                enabled: !_submitting,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Missing quantity ($_unit)',
                ),
                onChanged: (_) => setState(() {}),
              ),
              if ((int.tryParse(_damagedCtrl.text) ?? 0) > 0)
                TextField(
                  controller: _damagedCommentsCtrl,
                  enabled: !_submitting,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Damaged comments',
                    hintText: 'Describe the nature of the damaged stock...',
                  ),
                ),
              if ((int.tryParse(_missingCtrl.text) ?? 0) > 0)
                TextField(
                  controller: _missingCommentsCtrl,
                  enabled: !_submitting,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Missing comments',
                    hintText: 'Describe what is missing from the delivery...',
                  ),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Confirm Receipt'),
        ),
      ],
    );
  }
}
