import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/core/utils/sort_po.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

class PaymentsScreen extends ConsumerStatefulWidget {
  const PaymentsScreen({super.key});

  @override
  ConsumerState<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends ConsumerState<PaymentsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;
  int _page = 1;
  int _totalPages = 1;

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
      final res = await ref.read(apiRepositoryProvider).getPayments(
            page: _page,
            limit: 20,
          );
      if (!mounted) return;
      setState(() {
        _items = res.items;
        _totalPages = res.totalPages < 1 ? 1 : res.totalPages;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openRecord() async {
    try {
      final api = ref.read(apiRepositoryProvider);
      final orders = await api.getOrders(limit: 100);
      final pays = await api.getPayments(limit: 100);
      final payable = sortByPoNumberDesc(orders.items.where(_isPayablePo).toList());
      if (!mounted) return;

      final recorded = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _RecordPaymentDialog(
          payableOrders: payable,
          existingPayments: pays.items,
        ),
      );
      if (recorded == true) _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  bool _isPayablePo(Map<String, dynamic> o) {
    final paymentStatus = o['paymentStatus']?.toString() ?? '';
    final status = o['status']?.toString() ?? '';
    final invoice = o['invoiceFile']?.toString() ?? '';
    if (paymentStatus == 'Paid' || paymentStatus == 'Cancelled') return false;
    if (status == 'Rejected' || status == 'Cancelled') return false;
    if (status != 'Delivered') return false;
    return invoice.trim().isNotEmpty;
  }

  String _money(dynamic v) {
    final n = (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;
    return NumberFormat.currency(symbol: '\$', decimalDigits: 2).format(n);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authNotifierProvider).state.user;
    final canRecord = user?.isAccountant == true || user?.isAdmin == true;

    if (_loading && _items.isEmpty) return const LoadingView();
    if (_error != null && _items.isEmpty) {
      return ErrorView(message: _error!, onRetry: _load);
    }

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Payment Management',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Pay delivered & invoiced POs via WaafiPay mobile wallet.',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    if (canRecord) ...[
                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: ElevatedButton.icon(
                          onPressed: _openRecord,
                          icon: const Icon(Icons.add, size: 18),
                          label: const Text('Record Payment'),
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.25),
                        ),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Payment rules',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.primary,
                              fontSize: 13,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            '1) Supplier must upload invoice on the PO\n'
                            '2) Delivery must be marked Delivered\n'
                            '3) Mobile Wallet charges the phone via WaafiPay (approve PIN on the handset)',
                            style: TextStyle(
                              fontSize: 12,
                              height: 1.4,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Ledger Statements',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ],
                ),
              ),
            ),
            if (_items.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: EmptyView(message: 'No records found.'),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                sliver: SliverList.separated(
                  itemCount: _items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final p = _items[i];
                    final po = p['purchaseOrder'];
                    final poNum = po is Map
                        ? po['purchaseOrderNumber']?.toString() ?? 'Unlinked'
                        : 'Unlinked';
                    final payStatus = po is Map
                        ? po['paymentStatus']?.toString() ?? '—'
                        : '—';
                    final date = p['paymentDate'] != null
                        ? DateFormat.yMd().format(
                            DateTime.tryParse(p['paymentDate'].toString()) ??
                                DateTime.now(),
                          )
                        : '—';
                    final waafi = p['waafiTransactionId']?.toString();
                    final payer = p['payerAccountNo']?.toString();
                    final receipt = p['receiptFile']?.toString();

                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    poNum,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                    ),
                                  ),
                                ),
                                StatusChip(payStatus),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Paid: ${_money(p['paidAmount'])} · Remaining: ${_money(p['remainingBalance'])}',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${p['paymentMethod'] ?? '—'} · ${p['referenceNumber'] ?? '—'}',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                            if (waafi != null && waafi.isNotEmpty)
                              Text(
                                'Waafi: $waafi',
                                style: const TextStyle(
                                  color: AppColors.primary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            if (payer != null && payer.isNotEmpty)
                              Text(
                                'Mobile: $payer',
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 11,
                                ),
                              ),
                            Text(
                              'By ${popName(p['recordedBy'])} · $date',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                              ),
                            ),
                            if (receipt != null && receipt.trim().isNotEmpty)
                              const Padding(
                                padding: EdgeInsets.only(top: 4),
                                child: Text(
                                  'Receipt attached',
                                  style: TextStyle(
                                    color: AppColors.primary,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            if (_totalPages > 1)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton(
                        onPressed: _page <= 1
                            ? null
                            : () {
                                setState(() => _page -= 1);
                                _load();
                              },
                        child: const Text('Previous'),
                      ),
                      Text(
                        'Page $_page / $_totalPages',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      TextButton(
                        onPressed: _page >= _totalPages
                            ? null
                            : () {
                                setState(() => _page += 1);
                                _load();
                              },
                        child: const Text('Next'),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Matches web "Record Payment Payout" modal.
class _RecordPaymentDialog extends ConsumerStatefulWidget {
  final List<Map<String, dynamic>> payableOrders;
  final List<Map<String, dynamic>> existingPayments;

  const _RecordPaymentDialog({
    required this.payableOrders,
    required this.existingPayments,
  });

  @override
  ConsumerState<_RecordPaymentDialog> createState() =>
      _RecordPaymentDialogState();
}

class _RecordPaymentDialogState extends ConsumerState<_RecordPaymentDialog> {
  final _formKey = GlobalKey<FormState>();
  final _amountCtrl = TextEditingController();
  final _accountCtrl = TextEditingController();
  final _refCtrl = TextEditingController();

  String? _poId;
  String _method = 'Mobile Wallet';
  bool _submitting = false;
  String? _error;
  String? _receiptPath;
  String? _receiptName;

  double _poTotal = 0;
  double _poPaidBefore = 0;
  double _poRemaining = 0;

  static const _methods = [
    ('Mobile Wallet', 'Mobile Wallet (WaafiPay)'),
  ];

  @override
  void dispose() {
    _amountCtrl.dispose();
    _accountCtrl.dispose();
    _refCtrl.dispose();
    super.dispose();
  }

  /// Accept 0.01+, and treat 001 / 005 / 025 as cents → $0.01 / $0.05 / $0.25
  double parsePayAmount(String? raw) {
    final s = (raw ?? '').trim();
    if (s.isEmpty) return double.nan;
    if (RegExp(r'^0\d{2}$').hasMatch(s)) {
      return int.parse(s) / 100.0;
    }
    return double.tryParse(s) ?? double.nan;
  }

  void _onPoChanged(String? id) {
    setState(() {
      _poId = id;
      _poTotal = 0;
      _poPaidBefore = 0;
      _poRemaining = 0;
    });
    if (id == null || id.isEmpty) return;

    final order = widget.payableOrders.firstWhere(
      (o) => popId(o) == id,
      orElse: () => <String, dynamic>{},
    );
    final total = (order['grandTotal'] as num?)?.toDouble() ?? 0;
    final sumPaid = widget.existingPayments
        .where((p) => popId(p['purchaseOrder']) == id)
        .fold<double>(
          0,
          (sum, p) => sum + ((p['paidAmount'] as num?)?.toDouble() ?? 0),
        );

    setState(() {
      _poTotal = total;
      _poPaidBefore = sumPaid;
      _poRemaining = double.parse((total - sumPaid).toStringAsFixed(2));
    });
  }

  String _poLabel(Map<String, dynamic> o) {
    final poNumber = o['purchaseOrderNumber']?.toString() ?? 'PO';
    final supplier = o['supplier'];
    final company = supplier is Map
        ? (supplier['company'] ?? supplier['name'] ?? '').toString()
        : '';
    final total = (o['grandTotal'] as num?)?.toDouble() ?? 0;
    final money =
        NumberFormat.currency(symbol: '\$', decimalDigits: 2).format(total);
    if (company.isEmpty) return '$poNumber (Total: $money)';
    return '$poNumber - $company (Total: $money)';
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;

    final amount = parsePayAmount(_amountCtrl.text);
    if (!(amount >= 0.01)) {
      setState(() => _error = 'Minimum is \$0.01 (use 0.01)');
      return;
    }
    if (_poRemaining > 0 && amount > _poRemaining) {
      setState(() {
        _error =
            'Payment cannot exceed remaining balance of \$${_poRemaining.toStringAsFixed(2)}';
      });
      return;
    }

    setState(() => _submitting = true);
    try {
      final payload = <String, dynamic>{
        'purchaseOrder': _poId,
        'paidAmount': double.parse(amount.toStringAsFixed(2)),
        'paymentMethod': _method,
      };
      if (_method == 'Mobile Wallet') {
        payload['accountNo'] =
            _accountCtrl.text.trim().replaceFirst(RegExp(r'^\+'), '');
      } else {
        payload['referenceNumber'] = _refCtrl.text.trim();
      }

      await ref.read(apiRepositoryProvider).recordPayment(
            payload,
            receiptPath: _receiptPath,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          duration: const Duration(seconds: 5),
          content: Text(
            '\$${amount.toStringAsFixed(2)} Ayaad Ku\nbixisay adeega\nJAAMACADDA\nJAMHURIYA',
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

  String _digitsPhone(String? raw) =>
      (raw ?? '').trim().replaceFirst(RegExp(r'^\+'), '');

  Future<void> _pickReceipt() async {
    if (_submitting) return;
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'docx'],
    );
    if (result == null || result.files.single.path == null) return;
    setState(() {
      _receiptPath = result.files.single.path;
      _receiptName = result.files.single.name;
    });
  }

  @override
  Widget build(BuildContext context) {
    final preview = parsePayAmount(_amountCtrl.text);
    final showPreview = preview >= 0.01 && _poRemaining > 0;
    final isWallet = _method == 'Mobile Wallet';

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440, maxHeight: 720),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 8, 16),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Record Payment Payout',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: _submitting
                          ? null
                          : () => Navigator.pop(context, false),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.only(right: 8, bottom: 8),
                    child: Column(
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
                        DropdownButtonFormField<String>(
                          initialValue: _poId,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'SELECT PURCHASE ORDER',
                          ),
                          hint: const Text('Select PO (Delivered + Invoice)'),
                          items: widget.payableOrders
                              .map(
                                (o) => DropdownMenuItem(
                                  value: popId(o),
                                  child: Text(
                                    _poLabel(o),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: _submitting ? null : _onPoChanged,
                          validator: (v) =>
                              v == null || v.isEmpty ? 'Please select a PO' : null,
                        ),
                        if (widget.payableOrders.isEmpty)
                          const Padding(
                            padding: EdgeInsets.only(top: 6),
                            child: Text(
                              'No payable POs yet. Need: invoice uploaded + status Delivered + not fully paid.',
                              style: TextStyle(
                                color: AppColors.accent,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        if (_poId != null) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                              color: AppColors.primary.withValues(alpha: 0.05),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'PO LEDGER STATUS',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Expanded(
                                      child: _LedgerStat(
                                        'Total Price',
                                        '\$${_poTotal.toStringAsFixed(2)}',
                                      ),
                                    ),
                                    Expanded(
                                      child: _LedgerStat(
                                        'Paid Before',
                                        '\$${_poPaidBefore.toStringAsFixed(2)}',
                                      ),
                                    ),
                                    Expanded(
                                      child: _LedgerStat(
                                        'Outstanding',
                                        '\$${_poRemaining.toStringAsFixed(2)}',
                                        highlight: true,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: _method,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'PAYMENT METHOD',
                          ),
                          items: _methods
                              .map(
                                (m) => DropdownMenuItem(
                                  value: m.$1,
                                  child: Text(m.$2, overflow: TextOverflow.ellipsis),
                                ),
                              )
                              .toList(),
                          onChanged: _submitting
                              ? null
                              : (v) {
                                  if (v == null) return;
                                  setState(() => _method = v);
                                },
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _amountCtrl,
                          enabled: !_submitting,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'PAYMENT AMOUNT (\$)',
                            hintText: '0.01',
                            helperText: 'Ugu Yaraan Geli \$0.01 (cent)',
                            helperMaxLines: 2,
                          ),
                          onChanged: (_) => setState(() {}),
                          validator: (v) {
                            final n = parsePayAmount(v);
                            if (!(n >= 0.01)) {
                              return 'Minimum is \$0.01 (use 0.01)';
                            }
                            if (_poRemaining > 0 && n > _poRemaining) {
                              return 'Cannot exceed \$${_poRemaining.toStringAsFixed(2)}';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),
                        if (isWallet)
                          TextFormField(
                            controller: _accountCtrl,
                            enabled: !_submitting,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              labelText: 'PAYER MOBILE (EVC )',
                              hintText: '+25261XXXXXXX',
                              helperText:
                                  'Fadlan Geli Telefoonka Lacagta Laga Dirayo (\$0.01)',
                              helperMaxLines: 2,
                              prefixIcon: Icon(Icons.phone_android, size: 20),
                            ),
                            validator: (v) {
                              final s = _digitsPhone(v);
                              if (s.isEmpty) {
                                return 'Mobile account is required for WaafiPay';
                              }
                              if (!RegExp(r'^(252)?6\d{8}$|^0?6\d{8}$')
                                  .hasMatch(s)) {
                                return 'Use +25261XXXXXXX';
                              }
                              return null;
                            },
                          )
                        else
                          TextFormField(
                            controller: _refCtrl,
                            enabled: !_submitting,
                            decoration: const InputDecoration(
                              labelText: 'Transaction Reference Code',
                              hintText: 'e.g. TXN-94920942',
                            ),
                            validator: (v) {
                              if ((v ?? '').trim().isEmpty) {
                                return 'Transaction reference is required';
                              }
                              return null;
                            },
                          ),
                        const SizedBox(height: 12),
                        const Text(
                          'PAYMENT RECEIPT (OPTIONAL)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.4,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: _submitting ? null : _pickReceipt,
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 22,
                            ),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: AppColors.slate400.withValues(alpha: 0.55),
                                style: BorderStyle.solid,
                                width: 1.4,
                              ),
                            ),
                            child: Column(
                              children: [
                                const Icon(
                                  Icons.upload,
                                  color: AppColors.primary,
                                  size: 22,
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _receiptName ??
                                      'Click to choose receipt (optional)',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                const Text(
                                  'PDF, JPG, PNG, or DOCX',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (showPreview) ...[
                          const SizedBox(height: 10),
                          Text(
                            'Amount: \$${preview.toStringAsFixed(2)} · New Remaining: \$${(_poRemaining - preview).toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          height: 46,
                          child: ElevatedButton.icon(
                            onPressed: _submitting ? null : _submit,
                            icon: _submitting
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Icon(Icons.attach_money, size: 18),
                            label: Text(
                              _submitting
                                  ? (isWallet
                                      ? 'Waiting for WaafiPay / PIN…'
                                      : 'Saving…')
                                  : (isWallet
                                      ? 'Charge Mobile Wallet'
                                      : 'Post Payment Record'),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LedgerStat extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;

  const _LedgerStat(this.label, this.value, {this.highlight = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            color: AppColors.textSecondary,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 13,
            color: highlight ? AppColors.primary : null,
          ),
        ),
      ],
    );
  }
}
