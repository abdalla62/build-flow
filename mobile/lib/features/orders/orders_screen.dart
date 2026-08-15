import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/core/utils/media_url.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _busy = false;
  String? _error;
  String _statusFilter = '';
  String _paymentFilter = '';
  int _page = 1;
  int _totalPages = 1;

  static const _poStatuses = [
    'Pending',
    'Accepted',
    'Rejected',
    'Preparing',
    'Dispatched',
    'Delivered',
    'Cancelled',
  ];

  static const _paymentStatuses = [
    'Unpaid',
    'Partially Paid',
    'Paid',
    'Overdue',
  ];

  static const _supplierStatusOptions = [
    ('Accepted', 'Accept Order'),
    ('Rejected', 'Reject Order'),
    ('Preparing', 'Delivery Preparation'),
    ('Dispatched', 'Dispatched / Shipped'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiRepositoryProvider).getOrders(
            page: _page,
            limit: 20,
            search: _searchCtrl.text.trim(),
            status: _statusFilter.isEmpty ? null : _statusFilter,
            paymentStatus: _paymentFilter.isEmpty ? null : _paymentFilter,
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

  void _search() {
    setState(() => _page = 1);
    _load();
  }

  Future<void> _openEditOrder(Map<String, dynamic> order) async {
    if (_busy) return;
    final items = order['items'];
    final first = (items is List && items.isNotEmpty)
        ? Map<String, dynamic>.from(items.first as Map)
        : <String, dynamic>{};
    final qtyCtrl = TextEditingController(
      text: (first['quantity'] ?? 1).toString(),
    );
    final priceCtrl = TextEditingController(
      text: (first['unitPrice'] ?? 0).toString(),
    );
    final taxCtrl = TextEditingController(
      text: (order['tax'] ?? 0).toString(),
    );
    final discountCtrl = TextEditingController(
      text: (order['discount'] ?? 0).toString(),
    );
    String status = order['status']?.toString() ?? 'Pending';
    if (!_poStatuses.contains(status)) status = 'Pending';

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: Text('Update PO ${order['purchaseOrderNumber'] ?? ''}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${popName(first['material'])} — ${order['supplier'] is Map ? (order['supplier']['company'] ?? order['supplier']['name'] ?? '—') : '—'}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: qtyCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Quantity'),
                ),
                TextField(
                  controller: priceCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(labelText: 'Unit Price (\$)'),
                ),
                TextField(
                  controller: taxCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(labelText: 'Tax (\$)'),
                ),
                TextField(
                  controller: discountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(labelText: 'Discount (\$)'),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  key: ValueKey('edit-status-$status'),
                  initialValue: status,
                  decoration: const InputDecoration(labelText: 'PO Status'),
                  items: _poStatuses
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged: (v) => setLocal(() => status = v ?? status),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Payment status updates when Accountant records a payment (or PO is cancelled).',
                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Save Changes'),
            ),
          ],
        ),
      ),
    );

    if (ok != true) {
      qtyCtrl.dispose();
      priceCtrl.dispose();
      taxCtrl.dispose();
      discountCtrl.dispose();
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(apiRepositoryProvider).updateOrder(popId(order), {
        'quantity': num.tryParse(qtyCtrl.text) ?? 1,
        'unitPrice': num.tryParse(priceCtrl.text) ?? 0,
        'tax': num.tryParse(taxCtrl.text) ?? 0,
        'discount': num.tryParse(discountCtrl.text) ?? 0,
        'status': status,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Purchase order updated')),
        );
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      qtyCtrl.dispose();
      priceCtrl.dispose();
      taxCtrl.dispose();
      discountCtrl.dispose();
      if (mounted) setState(() => _busy = false);
    }
  }

  bool _canSupplierAct(Map<String, dynamic> order) {
    final user = ref.read(authNotifierProvider).state.user;
    if (user?.role != 'Supplier') return false;
    final supplier = order['supplier'];
    if (supplier is! Map) return true; // server already scopes supplier POs
    final email = supplier['email']?.toString().toLowerCase() ?? '';
    final userEmail = (user?.email ?? '').toLowerCase();
    if (email.isEmpty || userEmail.isEmpty) return true;
    return email == userEmail;
  }

  Future<void> _openUpdateStatus(Map<String, dynamic> order) async {
    if (_busy) return;
    String selected = order['status']?.toString() == 'Pending'
        ? 'Accepted'
        : (order['status']?.toString() ?? 'Accepted');
    if (!_supplierStatusOptions.any((e) => e.$1 == selected)) {
      selected = 'Accepted';
    }

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return AlertDialog(
              title: Text(
                'Update Status for PO ${order['purchaseOrderNumber'] ?? ''}',
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Select the appropriate status update for this order assignment.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    initialValue: selected,
                    decoration: const InputDecoration(
                      labelText: 'Fulfillment Status',
                    ),
                    items: _supplierStatusOptions
                        .map(
                          (e) => DropdownMenuItem(
                            value: e.$1,
                            child: Text(e.$2),
                          ),
                        )
                        .toList(),
                    onChanged: (v) {
                      if (v == null) return;
                      setLocal(() => selected = v);
                    },
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Post Status Update'),
                ),
              ],
            );
          },
        );
      },
    );
    if (ok != true) return;

    setState(() => _busy = true);
    try {
      await ref.read(apiRepositoryProvider).updateOrderStatus(
            popId(order),
            selected,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Order set to $selected')),
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

  Future<void> _openInvoiceFile(String? path) async {
    final url = mediaUrl(path);
    if (url == null || url.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invoice file not found')),
      );
      return;
    }
    final uri = Uri.parse(url);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open: $url')),
      );
    }
  }

  Future<void> _openInvoice(Map<String, dynamic> order) async {
    if (_busy) return;
    final pathCtrl = TextEditingController();
    String? pickedPath;

    final submitted = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return AlertDialog(
              title: Text(
                'Invoice for PO ${order['purchaseOrderNumber'] ?? ''}',
              ),
              content: SizedBox(
                width: 420,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
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
                            'Habka fudud (lagula talinayaa)',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'System-ku wuxuu PDF ka sameynayaa xogta PO — Word uma baahnid.',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: () => Navigator.pop(ctx, 'generate'),
                      icon: const Icon(Icons.auto_awesome, size: 18),
                      label: const Text('Generate Invoice from PO (1 click)'),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Ama upload custom file (PDF/JPG/PNG/DOCX)',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final result = await FilePicker.platform.pickFiles(
                          type: FileType.custom,
                          allowedExtensions: const [
                            'pdf',
                            'jpg',
                            'jpeg',
                            'png',
                            'docx',
                          ],
                        );
                        if (result == null ||
                            result.files.single.path == null) {
                          return;
                        }
                        setLocal(() {
                          pickedPath = result.files.single.path;
                          pathCtrl.text = result.files.single.name;
                        });
                      },
                      icon: const Icon(Icons.upload_file),
                      label: Text(
                        pickedPath == null
                            ? 'Browse custom invoice file'
                            : 'File: ${pathCtrl.text}',
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel'),
                ),
                ElevatedButton.icon(
                  onPressed: pickedPath == null
                      ? null
                      : () => Navigator.pop(ctx, 'upload'),
                  icon: const Icon(Icons.upload, size: 18),
                  label: const Text('Post Custom File'),
                ),
              ],
            );
          },
        );
      },
    );

    pathCtrl.dispose();
    if (submitted == null) return;

    setState(() => _busy = true);
    try {
      if (submitted == 'generate') {
        await ref.read(apiRepositoryProvider).generateInvoice(popId(order));
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invoice generated from PO — ready for payment!'),
          ),
        );
        _load();
      } else if (submitted == 'upload') {
        if (pickedPath == null || pickedPath!.isEmpty) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Please choose a file (PDF, JPG, PNG, or DOCX)'),
            ),
          );
        } else {
          await ref.read(apiRepositoryProvider).uploadInvoice(
                popId(order),
                invoicePath: pickedPath,
              );
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Invoice uploaded successfully. Notification sent to Accountant.',
              ),
            ),
          );
          _load();
        }
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _deleteOrder(Map<String, dynamic> order) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete purchase order?'),
        content: Text(
          'Delete ${order['purchaseOrderNumber']}? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(apiRepositoryProvider).deleteOrder(popId(order));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Purchase order deleted')),
      );
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  String _company(dynamic supplier) {
    if (supplier is Map) {
      return (supplier['company'] ?? supplier['name'] ?? '—').toString();
    }
    return '—';
  }

  String _rep(dynamic supplier) {
    if (supplier is Map) return (supplier['name'] ?? '—').toString();
    return '—';
  }

  String _money(dynamic v) {
    final n = (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;
    return NumberFormat.currency(symbol: '\$', decimalDigits: 2).format(n);
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authNotifierProvider).state.user?.role;
    final isProc = role == 'Procurement Officer' || role == 'Administrator';
    final isAdmin = role == 'Administrator';

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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Purchase Orders',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Monitor PO indexes, fulfillment progress, invoices, and payment states.',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          children: [
                            TextField(
                              controller: _searchCtrl,
                              textInputAction: TextInputAction.search,
                              onSubmitted: (_) => _search(),
                              decoration: InputDecoration(
                                hintText: 'Search PO number (e.g. PO-2026-00001)...',
                                prefixIcon: const Icon(Icons.search, size: 20),
                                suffixIcon: IconButton(
                                  icon: const Icon(Icons.arrow_forward),
                                  onPressed: _search,
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: DropdownButtonFormField<String>(
                                    key: ValueKey('po-$_statusFilter'),
                                    initialValue: _statusFilter,
                                    isExpanded: true,
                                    decoration: const InputDecoration(
                                      labelText: 'PO Status',
                                      isDense: true,
                                    ),
                                    items: [
                                      const DropdownMenuItem(
                                        value: '',
                                        child: Text('All PO Statuses'),
                                      ),
                                      ..._poStatuses.map(
                                        (s) => DropdownMenuItem(
                                          value: s,
                                          child: Text(s),
                                        ),
                                      ),
                                    ],
                                    onChanged: (v) {
                                      setState(() {
                                        _statusFilter = v ?? '';
                                        _page = 1;
                                      });
                                      _load();
                                    },
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: DropdownButtonFormField<String>(
                                    key: ValueKey('pay-$_paymentFilter'),
                                    initialValue: _paymentFilter,
                                    isExpanded: true,
                                    decoration: const InputDecoration(
                                      labelText: 'Payment',
                                      isDense: true,
                                    ),
                                    items: [
                                      const DropdownMenuItem(
                                        value: '',
                                        child: Text('All Payments'),
                                      ),
                                      ..._paymentStatuses.map(
                                        (s) => DropdownMenuItem(
                                          value: s,
                                          child: Text(s),
                                        ),
                                      ),
                                    ],
                                    onChanged: (v) {
                                      setState(() {
                                        _paymentFilter = v ?? '';
                                        _page = 1;
                                      });
                                      _load();
                                    },
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_items.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: EmptyView(message: 'No purchase orders found.'),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                sliver: SliverList.separated(
                  itemCount: _items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final o = _items[i];
                    final items = o['items'];
                    final first = (items is List && items.isNotEmpty)
                        ? Map<String, dynamic>.from(items.first as Map)
                        : <String, dynamic>{};
                    final material = first['material'];
                    final qty = first['quantity'];
                    final unitPrice = first['unitPrice'];
                    final materialName = popName(material);
                    final date = o['createdAt'] != null
                        ? DateFormat.yM().format(
                            DateTime.tryParse(o['createdAt'].toString()) ??
                                DateTime.now(),
                          )
                        : '—';
                    final invoice = o['invoiceFile']?.toString();
                    final hasInvoice = invoice != null && invoice.isNotEmpty;
                    final canAct = _canSupplierAct(o) || isAdmin;

                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: AppColors.primary.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(
                                    Icons.description_outlined,
                                    color: AppColors.primary,
                                    size: 22,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        o['purchaseOrderNumber']?.toString() ??
                                            'PO',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 15,
                                        ),
                                      ),
                                      Text(
                                        'Date: $date',
                                        style: const TextStyle(
                                          color: AppColors.textSecondary,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  _money(o['grandTotal']),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              _company(o['supplier']),
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            Text(
                              'Rep: ${_rep(o['supplier'])}',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '$qty x $materialName',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            Text(
                              'Unit Price: ${_money(unitPrice)}',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: [
                                StatusChip(o['status']?.toString() ?? '—'),
                                StatusChip(
                                  o['paymentStatus']?.toString() ?? 'Unpaid',
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: hasInvoice
                                        ? AppColors.primary.withValues(alpha: 0.1)
                                        : AppColors.border.withValues(alpha: 0.5),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    hasInvoice
                                        ? 'Invoice uploaded'
                                        : 'Invoice: Not Uploaded',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: hasInvoice
                                          ? AppColors.primary
                                          : AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                                if (hasInvoice)
                                  TextButton.icon(
                                    onPressed: () => _openInvoiceFile(invoice),
                                    icon: const Icon(Icons.download, size: 16),
                                    label: const Text('Download PDF'),
                                  ),
                              ],
                            ),
                            if (canAct || isProc) ...[
                              const SizedBox(height: 12),
                              if (isProc) ...[
                                SizedBox(
                                  width: double.infinity,
                                  child: OutlinedButton.icon(
                                    onPressed: () => _openEditOrder(o),
                                    icon: const Icon(Icons.edit_outlined, size: 16),
                                    label: const Text('Edit PO'),
                                  ),
                                ),
                                const SizedBox(height: 8),
                              ],
                              Row(
                                children: [
                                  if (canAct)
                                    Expanded(
                                      child: OutlinedButton(
                                        onPressed: () => _openUpdateStatus(o),
                                        child: const Text('Update Status'),
                                      ),
                                    ),
                                  if (canAct) const SizedBox(width: 8),
                                  if (canAct)
                                    Expanded(
                                      child: ElevatedButton.icon(
                                        onPressed: () => _openInvoice(o),
                                        icon: const Icon(Icons.upload, size: 16),
                                        label: const Text('Invoice'),
                                      ),
                                    ),
                                  if (isProc && !canAct)
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        onPressed: () => _deleteOrder(o),
                                        icon: const Icon(
                                          Icons.delete_outline,
                                          size: 16,
                                          color: AppColors.danger,
                                        ),
                                        label: const Text(
                                          'Delete',
                                          style: TextStyle(color: AppColors.danger),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              if (isProc && canAct) ...[
                                const SizedBox(height: 8),
                                SizedBox(
                                  width: double.infinity,
                                  child: TextButton.icon(
                                    onPressed: () => _deleteOrder(o),
                                    icon: const Icon(
                                      Icons.delete_outline,
                                      size: 16,
                                      color: AppColors.danger,
                                    ),
                                    label: const Text(
                                      'Delete PO',
                                      style: TextStyle(color: AppColors.danger),
                                    ),
                                  ),
                                ),
                              ],
                            ],
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
