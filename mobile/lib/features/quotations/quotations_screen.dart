import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

List<Map<String, dynamic>> quoteRequestLines(Map<String, dynamic> r) {
  final raw = r['lines'];
  if (raw is List && raw.isNotEmpty) {
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  return [r];
}

String quoteRequestIdOf(dynamic q) {
  if (q is Map) return popId(q['materialRequest']);
  return '';
}

class QuotationsScreen extends ConsumerStatefulWidget {
  const QuotationsScreen({super.key});

  @override
  ConsumerState<QuotationsScreen> createState() => _QuotationsScreenState();
}

class _QuotationsScreenState extends ConsumerState<QuotationsScreen> {
  List<Map<String, dynamic>> _openRequests = [];
  List<Map<String, dynamic>> _quotations = [];
  bool _loading = true;
  bool _busy = false;
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
            grouped: true,
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

  int _bidCountFor(Map<String, dynamic> request) {
    final ids = quoteRequestLines(request).map(popId).where((id) => id.isNotEmpty).toSet();
    final suppliers = <String>{};
    for (final q in _quotations) {
      if (ids.contains(quoteRequestIdOf(q))) {
        final sid = popId(q['supplier']);
        if (sid.isNotEmpty) suppliers.add(sid);
      }
    }
    return suppliers.length;
  }

  bool _alreadyBid(Map<String, dynamic> request) {
    final role = ref.read(authNotifierProvider).state.user?.role;
    if (role != 'Supplier') return false;
    final ids = quoteRequestLines(request).map(popId).where((id) => id.isNotEmpty).toSet();
    return _quotations.any((q) => ids.contains(quoteRequestIdOf(q)));
  }

  List<Map<String, dynamic>> _myPendingQuotes(Map<String, dynamic> request) {
    final role = ref.read(authNotifierProvider).state.user?.role;
    if (role != 'Supplier') return const [];
    final ids = quoteRequestLines(request).map(popId).where((id) => id.isNotEmpty).toSet();
    return _quotations
        .where(
          (q) =>
              ids.contains(quoteRequestIdOf(q)) &&
              q['status']?.toString() == 'Pending',
        )
        .toList();
  }

  Future<void> _openSubmitBid(
    Map<String, dynamic> request, {
    bool edit = false,
  }) async {
    final mine = _myPendingQuotes(request);
    final submitted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _SubmitBidDialog(
        request: request,
        existingQuotes: edit ? mine : const [],
        editing: edit && mine.isNotEmpty,
      ),
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
                    quoteRequestLines(request)
                        .map((l) => popName(l['material']))
                        .join(', '),
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
    if (_busy) return;
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
    setState(() => _busy = true);
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
    } finally {
      if (mounted) setState(() => _busy = false);
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
                    final lines = quoteRequestLines(r);
                    final project = r['project'];
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
                    final bids = _bidCountFor(r);
                    final already = _alreadyBid(r);

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
                            ...lines.map((line) {
                              final material = line['material'];
                              final qty = line['quantity'];
                              final unit = material is Map
                                  ? material['unit']?.toString() ?? ''
                                  : '';
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '$qty $unit',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    Text(
                                      popName(material),
                                      style: const TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),
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
                                  onPressed: () {
                                    final pending = _myPendingQuotes(r);
                                    if (already && pending.isEmpty) return;
                                    _openSubmitBid(
                                      r,
                                      edit: pending.isNotEmpty,
                                    );
                                  },
                                  child: Text(
                                    _myPendingQuotes(r).isNotEmpty
                                        ? 'Edit Bid'
                                        : already
                                            ? 'Bid already submitted'
                                            : 'Submit Bid',
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
  final List<Map<String, dynamic>> existingQuotes;
  final bool editing;

  const _SubmitBidDialog({
    required this.request,
    this.existingQuotes = const [],
    this.editing = false,
  });

  @override
  ConsumerState<_SubmitBidDialog> createState() => _SubmitBidDialogState();
}

class _SubmitBidDialogState extends ConsumerState<_SubmitBidDialog> {
  final _formKey = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _linePrices;
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

  List<Map<String, dynamic>> get _lines => quoteRequestLines(widget.request);

  @override
  void initState() {
    super.initState();
    _linePrices = {
      for (final line in _lines)
        popId(line): TextEditingController(
          text: () {
            final id = popId(line);
            Map<String, dynamic>? existing;
            for (final q in widget.existingQuotes) {
              if (quoteRequestIdOf(q) == id) {
                existing = q;
                break;
              }
            }
            if (existing != null) {
              return (existing['unitPrice'] as num?)?.toString() ?? '';
            }
            final material = line['material'];
            if (material is Map) {
              return (material['estimatedPrice'] as num?)?.toString() ?? '';
            }
            return '';
          }(),
        ),
    };
    final first = widget.existingQuotes.isNotEmpty
        ? widget.existingQuotes.first
        : null;
    _deliveryCost = TextEditingController(
      text: (first?['deliveryCost'] as num?)?.toString() ?? '50',
    );
    _days = TextEditingController(
      text: (first?['deliveryTimeDays'] as num?)?.toString() ?? '3',
    );
    _warranty = TextEditingController(
      text: (first?['warrantyMonths'] as num?)?.toString() ?? '12',
    );
    final terms = first?['paymentTerms']?.toString();
    if (terms != null && _terms.contains(terms)) _paymentTerms = terms;
  }

  @override
  void dispose() {
    for (final c in _linePrices.values) {
      c.dispose();
    }
    _deliveryCost.dispose();
    _days.dispose();
    _warranty.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      final body = {
        'materialRequest': popId(widget.request),
        'items': _lines
            .map(
              (line) => {
                'materialRequest': popId(line),
                'unitPrice':
                    double.tryParse(_linePrices[popId(line)]?.text.trim() ?? '') ??
                    0,
              },
            )
            .toList(),
        'deliveryCost': double.tryParse(_deliveryCost.text.trim()) ?? 0,
        'deliveryTimeDays': int.tryParse(_days.text.trim()) ?? 1,
        'warrantyMonths': int.tryParse(_warranty.text.trim()) ?? 0,
        'paymentTerms': _paymentTerms,
      };
      if (widget.editing) {
        await ref.read(apiRepositoryProvider).updateQuotationBatch(body);
      } else {
        await ref.read(apiRepositoryProvider).submitQuotationBatch(body);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.editing
                ? 'Bid updated successfully'
                : 'Bid quotation submitted successfully',
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
    final projectName = popName(widget.request['project']);

    return AlertDialog(
      title: Text(widget.editing ? 'Edit Bidding Quote' : 'Submit Bidding Quote'),
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
                      ..._lines.map((line) {
                        final material = line['material'];
                        final unit = material is Map
                            ? material['unit']?.toString() ?? 'units'
                            : 'units';
                        return Text(
                          '${line['quantity']} $unit of ${popName(material)}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        );
                      }),
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
                ..._lines.map((line) {
                  final id = popId(line);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: TextFormField(
                      controller: _linePrices[id],
                      enabled: !_submitting,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: InputDecoration(
                        labelText:
                            'Unit Price — ${popName(line['material'])} (\$)',
                      ),
                      validator: (v) {
                        final n = double.tryParse(v?.trim() ?? '');
                        if (n == null || n < 0) return 'Enter a valid price';
                        return null;
                      },
                    ),
                  );
                }),
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
              : Text(
                  widget.editing ? 'Save Bid Changes' : 'Post Bid Quotation',
                ),
        ),
      ],
    );
  }
}
