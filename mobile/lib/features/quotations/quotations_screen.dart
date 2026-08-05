import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

class QuotationsScreen extends ConsumerStatefulWidget {
  const QuotationsScreen({super.key});

  @override
  ConsumerState<QuotationsScreen> createState() => _QuotationsScreenState();
}

class _QuotationsScreenState extends ConsumerState<QuotationsScreen> {
  List<Map<String, dynamic>> _openRequests = [];
  List<Map<String, dynamic>> _quotations = [];
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
      final reqs = await ref.read(apiRepositoryProvider).getRequests(
            status: 'Approved',
            limit: 100,
          );
      final quotes = await ref.read(apiRepositoryProvider).getQuotations();
      if (!mounted) return;
      setState(() {
        _openRequests = reqs.items;
        _quotations = quotes;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _bidCountFor(String requestId) {
    return _quotations.where((q) {
      final mr = q['materialRequest'];
      return popId(mr) == requestId;
    }).length;
  }

  bool _alreadyBid(String requestId) {
    final role = ref.read(authNotifierProvider).state.user?.role;
    if (role != 'Supplier') return false;
    // Supplier quotations endpoint returns only their own bids.
    return _quotations.any((q) => popId(q['materialRequest']) == requestId);
  }

  Future<void> _openSubmitBid(Map<String, dynamic> request) async {
    final submitted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _SubmitBidDialog(request: request),
    );
    if (submitted == true) _load();
  }

  Future<void> _openCompare(Map<String, dynamic> request) async {
    final id = popId(request);
    List<Map<String, dynamic>> quotes = [];
    try {
      quotes = await ref.read(apiRepositoryProvider).getQuotations(requestId: id);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
      return;
    }
    if (!mounted) return;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.7,
          minChildSize: 0.4,
          maxChildSize: 0.95,
          builder: (_, scrollCtrl) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Compare Bids',
                    style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${popName(request['material'])} · ${popName(request['project'])}',
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: quotes.isEmpty
                        ? const Center(
                            child: Text(
                              'No quotation bids submitted yet.',
                              style: TextStyle(color: AppColors.textSecondary),
                            ),
                          )
                        : ListView.separated(
                            controller: scrollCtrl,
                            itemCount: quotes.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 8),
                            itemBuilder: (_, i) {
                              final q = quotes[i];
                              final qid = popId(q);
                              final selected = q['status']?.toString() == 'Selected';
                              return Card(
                                child: ListTile(
                                  title: Text(
                                    popName(q['supplier']),
                                    style: const TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                  subtitle: Text(
                                    'Unit \$${q['unitPrice']} · Delivery \$${q['deliveryCost']}\n'
                                    '${q['deliveryTimeDays']} days · ${q['paymentTerms']}',
                                  ),
                                  isThreeLine: true,
                                  trailing: selected
                                      ? const StatusChip('Selected')
                                      : TextButton(
                                          onPressed: () async {
                                            Navigator.pop(ctx);
                                            await _select(qid);
                                          },
                                          child: const Text('Award'),
                                        ),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _select(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Award contract?'),
        content: const Text(
          'Select this quotation and generate a Purchase Order?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(apiRepositoryProvider).selectQuotation(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Contract awarded — PO created')),
      );
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authNotifierProvider).state.user?.role;
    final isSupplier = role == 'Supplier';
    final canProcure = role == 'Procurement Officer' || role == 'Administrator';

    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        // No FAB — bids are submitted per open request (like web).
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isSupplier ? 'Supplier Bidding Board' : 'Supplier Quotes',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isSupplier
                          ? 'Review approved requests and submit bidding quotes.'
                          : 'Review approved requests, compare bids, and award contracts.',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Open Bidding Requests',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ],
                ),
              ),
            ),
            if (_openRequests.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: EmptyView(
                  message: 'No approved requests open for supplier quotes.',
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                sliver: SliverList.separated(
                  itemCount: _openRequests.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final r = _openRequests[i];
                    final id = popId(r);
                    final material = r['material'];
                    final project = r['project'];
                    final qty = r['quantity'];
                    final unit = material is Map ? material['unit']?.toString() ?? '' : '';
                    final materialName = popName(material);
                    final projectName = popName(project);
                    final location = project is Map
                        ? project['location']?.toString() ?? ''
                        : '';
                    final requiredBy = r['requiredDate'] != null
                        ? DateFormat.yMd().format(
                            DateTime.tryParse(r['requiredDate'].toString()) ??
                                DateTime.now(),
                          )
                        : '—';
                    final bids = _bidCountFor(id);
                    final already = _alreadyBid(id);

                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              projectName,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                              ),
                            ),
                            if (location.isNotEmpty)
                              Text(
                                location,
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                            const SizedBox(height: 8),
                            Text(
                              '$qty $unit',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            Text(
                              materialName,
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    'Required by: $requiredBy',
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                ),
                                Text(
                                  '$bids bid${bids == 1 ? '' : 's'}',
                                  style: const TextStyle(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            // Match web: Supplier + Admin can Submit Bid; Proc + Admin Compare.
                            if (isSupplier || role == 'Administrator')
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton(
                                  onPressed: already
                                      ? null
                                      : () => _openSubmitBid(r),
                                  child: Text(
                                    already ? 'Bid already submitted' : 'Submit Bid',
                                  ),
                                ),
                              ),
                            if (canProcure) ...[
                              if (isSupplier || role == 'Administrator')
                                const SizedBox(height: 8),
                              SizedBox(
                                width: double.infinity,
                                child: OutlinedButton(
                                  onPressed: () => _openCompare(r),
                                  child: const Text('Compare Bids'),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SubmitBidDialog extends ConsumerStatefulWidget {
  final Map<String, dynamic> request;

  const _SubmitBidDialog({required this.request});

  @override
  ConsumerState<_SubmitBidDialog> createState() => _SubmitBidDialogState();
}

class _SubmitBidDialogState extends ConsumerState<_SubmitBidDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _unitPrice;
  late final TextEditingController _deliveryCost;
  late final TextEditingController _days;
  late final TextEditingController _warranty;
  String _paymentTerms = 'Net 30';
  bool _submitting = false;
  String? _error;

  static const _terms = [
    'Cash on Delivery',
    'Net 15',
    'Net 30',
    'Net 60',
  ];

  @override
  void initState() {
    super.initState();
    final material = widget.request['material'];
    final est = material is Map
        ? (material['estimatedPrice'] as num?)?.toString() ?? ''
        : '';
    _unitPrice = TextEditingController(text: est);
    _deliveryCost = TextEditingController(text: '50');
    _days = TextEditingController(text: '3');
    _warranty = TextEditingController(text: '12');
  }

  @override
  void dispose() {
    _unitPrice.dispose();
    _deliveryCost.dispose();
    _days.dispose();
    _warranty.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      await ref.read(apiRepositoryProvider).submitQuotation({
        'materialRequest': popId(widget.request),
        'unitPrice': double.tryParse(_unitPrice.text.trim()) ?? 0,
        'deliveryCost': double.tryParse(_deliveryCost.text.trim()) ?? 0,
        'deliveryTimeDays': int.tryParse(_days.text.trim()) ?? 1,
        'warrantyMonths': int.tryParse(_warranty.text.trim()) ?? 0,
        'paymentTerms': _paymentTerms,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bid quotation submitted successfully')),
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
    final material = widget.request['material'];
    final unit = material is Map ? material['unit']?.toString() ?? 'units' : 'units';
    final materialName = popName(material);
    final projectName = popName(widget.request['project']);
    final qty = widget.request['quantity'];

    return AlertDialog(
      title: const Text('Submit Bidding Quote'),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
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
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                    color: AppColors.primary.withValues(alpha: 0.06),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'BIDDING TARGET',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$qty $unit of $materialName',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        'Project: $projectName',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _unitPrice,
                  enabled: !_submitting,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Unit Price Offer (\$)',
                  ),
                  validator: (v) {
                    final n = double.tryParse(v?.trim() ?? '');
                    if (n == null || n < 0) return 'Enter a valid price';
                    return null;
                  },
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _deliveryCost,
                  enabled: !_submitting,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Delivery Shipping Cost (\$)',
                  ),
                  validator: (v) {
                    final n = double.tryParse(v?.trim() ?? '');
                    if (n == null || n < 0) return 'Enter a valid cost';
                    return null;
                  },
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _days,
                        enabled: !_submitting,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Delivery Time (Days)',
                        ),
                        validator: (v) {
                          final n = int.tryParse(v?.trim() ?? '');
                          if (n == null || n < 1) return 'Min 1 day';
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextFormField(
                        controller: _warranty,
                        enabled: !_submitting,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Warranty (Months)',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _paymentTerms,
                  items: _terms
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: _submitting
                      ? null
                      : (v) {
                          if (v == null) return;
                          setState(() => _paymentTerms = v);
                        },
                  decoration: const InputDecoration(
                    labelText: 'Payment Terms offered',
                  ),
                ),
              ],
            ),
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
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Post Bid Quotation'),
        ),
      ],
    );
  }
}
