import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

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
      final res = await ref.read(apiRepositoryProvider).getRequests(limit: 100);
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

    String? projectId = popId(projects.items.first);
    String? materialId = popId(materials.items.first);
    final qty = TextEditingController(text: '1');
    final reason = TextEditingController();
    String priority = 'Medium';
    final requiredDate = TextEditingController(
      text: DateFormat('yyyy-MM-dd').format(DateTime.now().add(const Duration(days: 7))),
    );

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Material Request'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: projectId,
                items: projects.items
                    .map(
                      (p) => DropdownMenuItem(
                        value: popId(p),
                        child: Text(p['name']?.toString() ?? ''),
                      ),
                    )
                    .toList(),
                onChanged: (v) => projectId = v,
                decoration: const InputDecoration(labelText: 'Project'),
              ),
              DropdownButtonFormField<String>(
                initialValue: materialId,
                items: materials.items
                    .map(
                      (m) => DropdownMenuItem(
                        value: popId(m),
                        child: Text(m['name']?.toString() ?? ''),
                      ),
                    )
                    .toList(),
                onChanged: (v) => materialId = v,
                decoration: const InputDecoration(labelText: 'Material'),
              ),
              TextField(
                controller: qty,
                decoration: const InputDecoration(labelText: 'Quantity'),
                keyboardType: TextInputType.number,
              ),
              DropdownButtonFormField<String>(
                initialValue: priority,
                items: ['Low', 'Medium', 'High', 'Urgent']
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (v) => priority = v ?? priority,
                decoration: const InputDecoration(labelText: 'Priority'),
              ),
              TextField(
                controller: requiredDate,
                decoration: const InputDecoration(
                  labelText: 'Required Date (yyyy-MM-dd)',
                ),
              ),
              TextField(
                controller: reason,
                decoration: const InputDecoration(labelText: 'Reason'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Submit')),
        ],
      ),
    );

    final quantity = int.tryParse(qty.text) ?? 1;
    final reasonText = reason.text;
    final dateText = requiredDate.text;
    qty.dispose();
    reason.dispose();
    requiredDate.dispose();

    if (ok != true || projectId == null || materialId == null) return;

    try {
      await ref.read(apiRepositoryProvider).createRequest({
        'project': projectId,
        'material': materialId,
        'quantity': quantity,
        'priority': priority,
        'reason': reasonText,
        'requiredDate': dateText,
      });
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    }
  }

  Future<void> _openItem(Map<String, dynamic> item) async {
    final role = ref.read(authNotifierProvider).state.user?.role;
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
    final canReview = (role == 'Project Manager' || role == 'Administrator') &&
        ['Pending', 'Returned', 'Rejected'].contains(status);

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
        ),
      );
      if (posted == true) _load();
      return;
    }

    // Read-only detail (+ receive for Site Engineer)
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
            Text('Qty: ${req['quantity']} · Priority: ${req['priority']}'),
            Text('Status: ${req['status']}'),
            Text('Reason: ${req['reason'] ?? '—'}'),
            const SizedBox(height: 16),
            if ((role == 'Site Engineer' || role == 'Administrator') &&
                status == 'Delivered') ...[
              ElevatedButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await _receive(id);
                },
                child: const Text('Mark Received'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _receive(String id) async {
    try {
      await ref.read(apiRepositoryProvider).receiveRequest(id);
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
                  final canReview =
                      (role == 'Project Manager' || role == 'Administrator') &&
                          ['Pending', 'Returned', 'Rejected']
                              .contains(r['status']?.toString());
                  return ModuleListTile(
                    title: popName(r['material']),
                    subtitle: '${popName(r['project'])} · Qty ${r['quantity']}',
                    status: r['status']?.toString(),
                    icon: Icons.assignment_outlined,
                    onTap: () => _openItem(r),
                    trailing: canReview
                        ? TextButton(
                            onPressed: () => _openItem(r),
                            child: const Text('Review'),
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

  const _ReviewRequestDialog({
    required this.request,
    required this.suppliers,
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

  double get _estimatedCost => _qty * _unitPrice;

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

  String get _reason => widget.request['reason']?.toString() ?? '—';

  String _money(double v) {
    return NumberFormat.currency(symbol: '\$', decimalDigits: 0).format(v);
  }

  Future<void> _submit() async {
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
    return AlertDialog(
      title: const Text('Review Material Request'),
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
                    Text(
                      '${_qty.toInt()} $_unit of $_materialName',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
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
                      'Include details about budget approval status or reason for returning…',
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
              : const Text('Post Review Decision'),
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
