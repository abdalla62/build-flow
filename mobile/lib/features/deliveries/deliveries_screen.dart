import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/core/utils/media_url.dart';
import 'package:construction_material_mobile_app/core/utils/sort_po.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

class DeliveriesScreen extends ConsumerStatefulWidget {
  const DeliveriesScreen({super.key});

  @override
  ConsumerState<DeliveriesScreen> createState() => _DeliveriesScreenState();
}

class _DeliveriesScreenState extends ConsumerState<DeliveriesScreen> {
  List<Map<String, dynamic>> _items = [];
  List<Map<String, dynamic>> _calendarItems = [];
  bool _loading = true;
  bool _calendarLoading = false;
  String? _error;
  String _statusFilter = '';
  int _page = 1;
  int _totalPages = 1;
  String _viewMode = 'list'; // list | calendar
  DateTime _calendarMonth = DateTime(DateTime.now().year, DateTime.now().month);
  String? _selectedDayKey;
  bool _busy = false;

  static const _statusFilters = [
    'Scheduled',
    'Preparing',
    'Dispatched',
    'In Transit',
    'Delivered',
    'Delayed',
    'Rescheduled',
    'Cancelled',
  ];

  static const _timeSlots = [
    '9 AM - 12 PM',
    '12 PM - 3 PM',
    '3 PM - 6 PM',
  ];

  static const _driverStatusOptions = [
    ('Preparing', 'Preparing Cargo'),
    ('Dispatched', 'Dispatched / Left Depot'),
    ('In Transit', 'In Transit'),
    ('Delivered', 'Delivered successfully'),
    ('Delayed', 'Delayed'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _roleOf(dynamic role) {
    if (role is Map) return role['name']?.toString() ?? '';
    return role?.toString() ?? '';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiRepositoryProvider).getDeliveries(
            page: _page,
            limit: 20,
            status: _statusFilter.isEmpty ? null : _statusFilter,
          );
      if (!mounted) return;
      setState(() {
        _items = sortByPoNumberDesc(
          res.items,
          getNumber: (d) {
            final po = d['purchaseOrder'];
            if (po is Map) return po['purchaseOrderNumber']?.toString() ?? '';
            return '';
          },
        );
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

  String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

  Future<void> _loadCalendar() async {
    setState(() => _calendarLoading = true);
    try {
      final start = DateTime(_calendarMonth.year, _calendarMonth.month, 1);
      final end = DateTime(_calendarMonth.year, _calendarMonth.month + 1, 0);
      final res = await ref.read(apiRepositoryProvider).getDeliveries(
            page: 1,
            limit: 200,
            status: _statusFilter.isEmpty ? null : _statusFilter,
            fromDate: _ymd(start),
            toDate: _ymd(end),
          );
      if (!mounted) return;
      setState(() {
        _calendarItems = sortByPoNumberDesc(
          res.items,
          getNumber: (d) {
            final po = d['purchaseOrder'];
            if (po is Map) return po['purchaseOrderNumber']?.toString() ?? '';
            return '';
          },
        );
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _calendarLoading = false);
    }
  }

  Future<void> _refresh() async {
    if (_viewMode == 'calendar') {
      await _loadCalendar();
    } else {
      await _load();
    }
  }

  Future<void> _openReschedule(Map<String, dynamic> delivery) async {
    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _RescheduleDialog(delivery: delivery),
    );
    if (ok == true) _refresh();
  }

  Future<void> _openSchedule() async {
    try {
      final orders = await ref
          .read(apiRepositoryProvider)
          .getOrders(status: 'Accepted', limit: 100);
      final users = await ref.read(apiRepositoryProvider).getUsers(limit: 100);
      final drivers = users.items
          .where((u) => _roleOf(u['role']) == 'Delivery Staff')
          .toList();

      if (!mounted) return;
      if (orders.items.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No accepted POs available to schedule')),
        );
        return;
      }
      if (drivers.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No Delivery Staff drivers found')),
        );
        return;
      }

      final scheduled = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => _ScheduleDispatchDialog(
          orders: sortByPoNumberDesc(orders.items),
          drivers: drivers,
          timeSlots: _timeSlots,
        ),
      );
      if (scheduled == true) _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _openUpdateStatus(Map<String, dynamic> delivery) async {
    if (_busy) return;
    String selected = delivery['status']?.toString() ?? 'Preparing';
    if (!_driverStatusOptions.any((e) => e.$1 == selected)) {
      selected = 'Preparing';
    }
    final po = delivery['purchaseOrder'];
    final poNum = po is Map
        ? po['purchaseOrderNumber']?.toString() ?? ''
        : '';

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return AlertDialog(
              title: Text('Update Shipment Status for PO $poNum'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Update the current tracking state of this delivery.',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    initialValue: selected,
                    decoration: const InputDecoration(
                      labelText: 'Tracking Status',
                    ),
                    items: _driverStatusOptions
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
                  if (selected == 'Delivered') ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.3),
                        ),
                      ),
                      child: const Text(
                        'Marking as Delivered will update inventory and notify the Site Engineer.',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ],
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
      await ref
          .read(apiRepositoryProvider)
          .updateDeliveryStatus(popId(delivery), selected);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Delivery status updated to $selected')),
      );
      _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _uploadNote(Map<String, dynamic> delivery) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'docx'],
    );
    if (result == null || result.files.single.path == null) return;
    try {
      await ref.read(apiRepositoryProvider).uploadDeliveryNote(
            popId(delivery),
            notePath: result.files.single.path,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Signed delivery note uploaded')),
      );
      _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _deleteDelivery(Map<String, dynamic> delivery) async {
    final po = delivery['purchaseOrder'];
    final poNum = po is Map
        ? po['purchaseOrderNumber']?.toString() ?? 'this delivery'
        : 'this delivery';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete delivery?'),
        content: Text('Delete delivery for $poNum?'),
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
      await ref.read(apiRepositoryProvider).deleteDelivery(popId(delivery));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Delivery deleted')),
      );
      _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  String _poNumber(Map<String, dynamic> d) {
    final po = d['purchaseOrder'];
    if (po is Map) return po['purchaseOrderNumber']?.toString() ?? 'PO';
    return 'PO';
  }

  String _materialLine(Map<String, dynamic> d) {
    final po = d['purchaseOrder'];
    if (po is! Map) return '—';
    final items = po['items'];
    if (items is! List || items.isEmpty) return '—';
    final first = items.first;
    if (first is! Map) return '—';
    final qty = first['quantity'];
    final name = popName(first['material']);
    return '$qty x $name';
  }

  String _supplierLine(Map<String, dynamic> d) {
    final po = d['purchaseOrder'];
    if (po is! Map) return '—';
    final supplier = po['supplier'];
    if (supplier is Map) {
      return (supplier['company'] ?? supplier['name'] ?? '—').toString();
    }
    return '—';
  }

  String _projectName(Map<String, dynamic> d) {
    final po = d['purchaseOrder'];
    if (po is! Map) return 'Central warehouse';
    final mr = po['materialRequest'];
    if (mr is Map) {
      final project = mr['project'];
      if (project is Map) return project['name']?.toString() ?? 'Central warehouse';
    }
    return 'Central warehouse';
  }

  String _vehicleLine(Map<String, dynamic> d) {
    final plate = d['vehicle']?.toString() ??
        (d['driver'] is Map
            ? d['driver']['vehiclePlateCode']?.toString()
            : null);
    return (plate == null || plate.isEmpty) ? '—' : plate;
  }

  bool _isAssignedDriver(Map<String, dynamic> d) {
    final user = ref.read(authNotifierProvider).state.user;
    if (user == null) return false;
    if (user.role == 'Administrator') return true;
    if (user.role != 'Delivery Staff') return false;
    final driver = d['driver'];
    final driverId = popId(driver);
    return driverId.isNotEmpty && driverId == user.id;
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authNotifierProvider).state.user?.role;
    final isProc = role == 'Procurement Officer' || role == 'Administrator';
    final isDriver = role == 'Delivery Staff' || role == 'Administrator';

    if (_loading && _items.isEmpty && _viewMode == 'list') {
      return const LoadingView();
    }
    if (_error != null && _items.isEmpty && _viewMode == 'list') {
      return ErrorView(message: _error!, onRetry: _load);
    }

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _refresh,
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
                      'Delivery Shipments',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Schedule logistics, view the delivery calendar, and reschedule when needed.',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    if (isProc) ...[
                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: ElevatedButton.icon(
                          onPressed: _openSchedule,
                          icon: const Icon(Icons.add, size: 18),
                          label: const Text('Schedule'),
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(
                          value: 'list',
                          label: Text('List'),
                          icon: Icon(Icons.list_rounded, size: 18),
                        ),
                        ButtonSegment(
                          value: 'calendar',
                          label: Text('Calendar'),
                          icon: Icon(Icons.calendar_month_rounded, size: 18),
                        ),
                      ],
                      selected: {_viewMode},
                      onSelectionChanged: (s) {
                        final mode = s.first;
                        setState(() => _viewMode = mode);
                        if (mode == 'calendar') {
                          _loadCalendar();
                        } else {
                          _load();
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      key: ValueKey('status-$_statusFilter'),
                      initialValue: _statusFilter,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Shipping Status',
                        isDense: true,
                      ),
                      items: [
                        const DropdownMenuItem(
                          value: '',
                          child: Text('All Shipping Statuses'),
                        ),
                        ..._statusFilters.map(
                          (s) => DropdownMenuItem(value: s, child: Text(s)),
                        ),
                      ],
                      onChanged: (v) {
                        setState(() {
                          _statusFilter = v ?? '';
                          _page = 1;
                        });
                        _refresh();
                      },
                    ),
                  ],
                ),
              ),
            ),
            if (_viewMode == 'calendar')
              // ignore: prefer_const_constructors — dynamic calendar body
              (!_calendarLoading)
                  ? SliverToBoxAdapter(
                      child: _DeliveryCalendar(
                        month: _calendarMonth,
                        deliveries: _calendarItems,
                        selectedDayKey: _selectedDayKey,
                        onPrevMonth: () {
                          setState(() {
                            _calendarMonth = DateTime(
                              _calendarMonth.year,
                              _calendarMonth.month - 1,
                            );
                            _selectedDayKey = null;
                          });
                          _loadCalendar();
                        },
                        onNextMonth: () {
                          setState(() {
                            _calendarMonth = DateTime(
                              _calendarMonth.year,
                              _calendarMonth.month + 1,
                            );
                            _selectedDayKey = null;
                          });
                          _loadCalendar();
                        },
                        onSelectDay: (key) =>
                            setState(() => _selectedDayKey = key),
                        isProc: isProc,
                        onReschedule: _openReschedule,
                      ),
                    )
                  : const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: LoadingView(message: 'Loading calendar…'),
                      ),
                    )
            else if (_items.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: EmptyView(message: 'No deliveries found.'),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                sliver: SliverList.separated(
                  itemCount: _items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final d = _items[i];
                    final date = d['deliveryDate'] != null
                        ? DateFormat.yMd().format(
                            DateTime.tryParse(d['deliveryDate'].toString()) ??
                                DateTime.now(),
                          )
                        : '—';
                    final note = d['deliveryNoteFile']?.toString();
                    final hasNote = note != null && note.isNotEmpty;
                    final canDriverAct = isDriver && _isAssignedDriver(d);
                    final canReschedule = isProc &&
                        d['status']?.toString() != 'Delivered' &&
                        d['status']?.toString() != 'Cancelled';

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
                                    _poNumber(d),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                    ),
                                  ),
                                ),
                                StatusChip(d['status']?.toString() ?? '—'),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Material: ${_materialLine(d)}',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _supplierLine(d),
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            Text(
                              _projectName(d),
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(
                                  Icons.location_on_outlined,
                                  size: 14,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    d['deliveryAddress']?.toString() ?? '—',
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(
                                  Icons.calendar_today_outlined,
                                  size: 14,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(width: 4),
                                Text(date, style: const TextStyle(fontSize: 12)),
                                const SizedBox(width: 12),
                                const Icon(
                                  Icons.access_time,
                                  size: 14,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  d['timeSlot']?.toString() ?? '—',
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Driver: ${popName(d['driver'])} · ${_vehicleLine(d)}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            Text(
                              hasNote
                                  ? 'Delivery note: Signed'
                                  : 'Delivery note: No Note',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: hasNote
                                    ? AppColors.primary
                                    : AppColors.textSecondary,
                              ),
                            ),
                            if (hasNote)
                              Align(
                                alignment: Alignment.centerLeft,
                                child: TextButton.icon(
                                  onPressed: () async {
                                    final url = mediaUrl(note);
                                    if (url == null) return;
                                    await launchUrl(
                                      Uri.parse(url),
                                      mode: LaunchMode.externalApplication,
                                    );
                                  },
                                  icon: const Icon(Icons.download, size: 16),
                                  label: const Text('Download note'),
                                ),
                              ),
                            if (canDriverAct || isProc) ...[
                              const SizedBox(height: 12),
                              if (canDriverAct)
                                Row(
                                  children: [
                                    Expanded(
                                      child: OutlinedButton(
                                        onPressed: () => _openUpdateStatus(d),
                                        child: const Text('Update Status'),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: ElevatedButton.icon(
                                        onPressed: () => _uploadNote(d),
                                        icon: const Icon(Icons.upload, size: 16),
                                        label: const Text('Note'),
                                      ),
                                    ),
                                  ],
                                ),
                              if (canReschedule) ...[
                                if (canDriverAct) const SizedBox(height: 8),
                                SizedBox(
                                  width: double.infinity,
                                  child: OutlinedButton.icon(
                                    onPressed: () => _openReschedule(d),
                                    icon: const Icon(Icons.event_repeat, size: 16),
                                    label: const Text('Reschedule'),
                                  ),
                                ),
                              ],
                              if (isProc) ...[
                                const SizedBox(height: 4),
                                SizedBox(
                                  width: double.infinity,
                                  child: TextButton.icon(
                                    onPressed: () => _deleteDelivery(d),
                                    icon: const Icon(
                                      Icons.delete_outline,
                                      size: 16,
                                      color: AppColors.danger,
                                    ),
                                    label: const Text(
                                      'Delete Delivery',
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
            if (_viewMode == 'list' && _totalPages > 1)
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

/// Matches web "Schedule Shipment Dispatch" modal.
class _ScheduleDispatchDialog extends ConsumerStatefulWidget {
  final List<Map<String, dynamic>> orders;
  final List<Map<String, dynamic>> drivers;
  final List<String> timeSlots;

  const _ScheduleDispatchDialog({
    required this.orders,
    required this.drivers,
    required this.timeSlots,
  });

  @override
  ConsumerState<_ScheduleDispatchDialog> createState() =>
      _ScheduleDispatchDialogState();
}

class _ScheduleDispatchDialogState
    extends ConsumerState<_ScheduleDispatchDialog> {
  final _formKey = GlobalKey<FormState>();
  final _vehicleCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  String? _poId;
  String? _driverId;
  DateTime? _date;
  String _timeSlot = '9 AM - 12 PM';
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _vehicleCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  String _poLabel(Map<String, dynamic> o) {
    final num = o['purchaseOrderNumber']?.toString() ?? 'PO';
    final supplier = o['supplier'];
    final company = supplier is Map
        ? (supplier['company'] ?? supplier['name'] ?? '').toString()
        : '';
    final items = o['items'];
    String itemPart = '';
    if (items is List && items.isNotEmpty && items.first is Map) {
      final first = items.first as Map;
      itemPart = '${first['quantity']} x ${popName(first['material'])}';
    }
    final parts = <String>[num];
    if (company.isNotEmpty) parts.add(company);
    if (itemPart.isNotEmpty) parts.add('($itemPart)');
    return parts.join(' - ');
  }

  String _toYmd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

  String? _requiredDateYmdForPo(String? poId) {
    if (poId == null || poId.isEmpty) return null;
    final order = widget.orders.firstWhere(
      (o) => popId(o) == poId,
      orElse: () => <String, dynamic>{},
    );
    final mr = order['materialRequest'];
    if (mr is! Map) return null;
    final raw = mr['requiredDate']?.toString() ?? '';
    if (raw.isEmpty) return null;
    // Match web: use calendar date from ISO string (YYYY-MM-DD)
    return raw.contains('T') ? raw.split('T').first : raw;
  }

  DateTime? _requiredDateForPo(String? poId) {
    final ymd = _requiredDateYmdForPo(poId);
    if (ymd == null || ymd.isEmpty) return null;
    final parts = ymd.split('-');
    if (parts.length != 3) return null;
    final y = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    final d = int.tryParse(parts[2]);
    if (y == null || m == null || d == null) return null;
    return DateTime(y, m, d);
  }

  void _onPoChanged(String? id) {
    setState(() {
      _poId = id;
      _date = null; // user must re-enter date for the new PO
      _error = null;
    });
  }

  void _onDriverChanged(String? id) {
    setState(() => _driverId = id);
    if (id == null) {
      _vehicleCtrl.clear();
      return;
    }
    final driver = widget.drivers.firstWhere(
      (d) => popId(d) == id,
      orElse: () => <String, dynamic>{},
    );
    // Always use registered plate from driver profile (locked field)
    _vehicleCtrl.text = driver['vehiclePlateCode']?.toString() ?? '';
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final required = _requiredDateForPo(_poId);
    final lastDate = required != null && !required.isBefore(today)
        ? required
        : today.add(const Duration(days: 365));
    final initial = _date ??
        (required != null && !required.isBefore(today) && !required.isAfter(lastDate)
            ? required
            : today);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial.isAfter(lastDate) ? lastDate : initial,
      firstDate: today,
      lastDate: lastDate,
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;
    if (_date == null) {
      setState(() => _error = 'Please select a delivery date');
      return;
    }

    final requiredYmd = _requiredDateYmdForPo(_poId);
    if (requiredYmd == null || requiredYmd.isEmpty) {
      setState(() =>
          _error = 'Selected PO has no required date from Site Engineer');
      return;
    }

    final dateStr = _toYmd(_date!);
    if (dateStr.compareTo(requiredYmd) > 0) {
      final requiredDate = _requiredDateForPo(_poId);
      final display = requiredDate != null
          ? DateFormat.yMd().format(requiredDate)
          : requiredYmd;
      setState(() {
        _error =
            'Taariikhda waa in ay ahaato $display ama ka hor. Lama dooran karo taariikh ka dambeeya.';
      });
      return;
    }

    setState(() => _submitting = true);
    try {
      await ref.read(apiRepositoryProvider).scheduleDelivery({
        'purchaseOrder': _poId,
        'driver': _driverId,
        'vehicle': _vehicleCtrl.text.trim(),
        'deliveryAddress': _addressCtrl.text.trim(),
        'deliveryDate': dateStr,
        'timeSlot': _timeSlot,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Delivery scheduled successfully! Driver notified.'),
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
    final requiredHintDate = _requiredDateForPo(_poId);
    final requiredHint = requiredHintDate == null
        ? null
        : 'Allowed on or before Site Engineer required date: ${DateFormat.yMd().format(requiredHintDate)}';

    return AlertDialog(
      title: const Text('Schedule Shipment Dispatch'),
      content: SizedBox(
        width: 440,
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
                DropdownButtonFormField<String>(
                  initialValue: _poId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Select Accepted PO',
                  ),
                  hint: const Text('Select PO'),
                  items: widget.orders
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
                      v == null || v.isEmpty ? 'Please select PO' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _driverId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Assign Driver',
                  ),
                  hint: const Text('Select Driver'),
                  items: widget.drivers.map((d) {
                    final plate = d['vehiclePlateCode']?.toString() ?? '';
                    final name = d['name']?.toString() ?? 'Driver';
                    final label =
                        plate.isEmpty ? name : '$name ($plate)';
                    return DropdownMenuItem(
                      value: popId(d),
                      child: Text(label, overflow: TextOverflow.ellipsis),
                    );
                  }).toList(),
                  onChanged: _submitting ? null : _onDriverChanged,
                  validator: (v) =>
                      v == null || v.isEmpty ? 'Please assign a driver' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _vehicleCtrl,
                  readOnly: true,
                  enableInteractiveSelection: false,
                  decoration: const InputDecoration(
                    labelText: 'Vehicle Plate Code',
                    hintText: 'Select a driver first',
                    helperText:
                        'Locked to driver profile — cannot be changed here.',
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Selected driver has no registered vehicle plate'
                      : null,
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: _submitting ? null : _pickDate,
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: 'Delivery Date',
                      errorText: null,
                      suffixIcon: const Icon(Icons.calendar_today, size: 18),
                      enabled: !_submitting,
                      helperText: requiredHint,
                    ),
                    child: Text(
                      _date == null
                          ? 'mm/dd/yyyy'
                          : DateFormat.yMd().format(_date!),
                      style: TextStyle(
                        color: _date == null
                            ? AppColors.textSecondary
                            : null,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _timeSlot,
                  decoration: const InputDecoration(labelText: 'Time Slot'),
                  items: widget.timeSlots
                      .map(
                        (s) => DropdownMenuItem(value: s, child: Text(s)),
                      )
                      .toList(),
                  onChanged: _submitting
                      ? null
                      : (v) {
                          if (v == null) return;
                          setState(() => _timeSlot = v);
                        },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _addressCtrl,
                  enabled: !_submitting,
                  decoration: const InputDecoration(
                    labelText: 'Delivery Destination Address',
                    hintText: 'e.g. Building B, Main Street',
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Destination is required'
                      : null,
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
              : const Text('Dispatch & Notify Driver'),
        ),
      ],
    );
  }
}

/// Month calendar for deliveries (10.7).
class _DeliveryCalendar extends StatelessWidget {
  final DateTime month;
  final List<Map<String, dynamic>> deliveries;
  final String? selectedDayKey;
  final VoidCallback onPrevMonth;
  final VoidCallback onNextMonth;
  final ValueChanged<String> onSelectDay;
  final bool isProc;
  final Future<void> Function(Map<String, dynamic>) onReschedule;

  const _DeliveryCalendar({
    required this.month,
    required this.deliveries,
    required this.selectedDayKey,
    required this.onPrevMonth,
    required this.onNextMonth,
    required this.onSelectDay,
    required this.isProc,
    required this.onReschedule,
  });

  String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final year = month.year;
    final mon = month.month;
    final firstDow = DateTime(year, mon, 1).weekday % 7;
    final daysInMonth = DateTime(year, mon + 1, 0).day;
    final todayKey = _ymd(DateTime.now());

    final byDay = <String, List<Map<String, dynamic>>>{};
    for (final d in deliveries) {
      final raw = d['deliveryDate'];
      if (raw == null) continue;
      final dt = DateTime.tryParse(raw.toString());
      if (dt == null) continue;
      final key = _ymd(dt);
      byDay.putIfAbsent(key, () => []).add(d);
    }

    final cells = <int?>[];
    for (var i = 0; i < firstDow; i++) {
      cells.add(null);
    }
    for (var day = 1; day <= daysInMonth; day++) {
      cells.add(day);
    }

    final selected = selectedDayKey;
    final dayList =
        selected == null ? <Map<String, dynamic>>[] : (byDay[selected] ?? []);
    final overlapCount = byDay.values.where((e) => e.length > 1).length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  Row(
                    children: [
                      IconButton(
                        onPressed: onPrevMonth,
                        icon: const Icon(Icons.chevron_left),
                      ),
                      Expanded(
                        child: Text(
                          DateFormat.yMMMM().format(month),
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                      IconButton(
                        onPressed: onNextMonth,
                        icon: const Icon(Icons.chevron_right),
                      ),
                    ],
                  ),
                  if (overlapCount > 0)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        '$overlapCount day(s) have overlapping deliveries',
                        style: const TextStyle(
                          color: AppColors.accent,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  Row(
                    children: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
                        .map(
                          (d) => Expanded(
                            child: Center(
                              child: Text(
                                d,
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 4),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: cells.length,
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 7,
                      mainAxisSpacing: 4,
                      crossAxisSpacing: 4,
                      childAspectRatio: 0.85,
                    ),
                    itemBuilder: (_, i) {
                      final day = cells[i];
                      if (day == null) return const SizedBox.shrink();
                      final key = _ymd(DateTime(year, mon, day));
                      final count = byDay[key]?.length ?? 0;
                      final isSelected = key == selectedDayKey;
                      final today = key == todayKey;
                      final overlap = count > 1;
                      return InkWell(
                        onTap: () => onSelectDay(key),
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected
                                  ? AppColors.primary
                                  : overlap
                                      ? AppColors.accent.withValues(alpha: 0.5)
                                      : AppColors.border,
                            ),
                            color: isSelected
                                ? AppColors.primary.withValues(alpha: 0.1)
                                : overlap
                                    ? AppColors.accent.withValues(alpha: 0.08)
                                    : null,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$day',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: today ? AppColors.primary : null,
                                ),
                              ),
                              if (count > 0)
                                Text(
                                  '$count',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: overlap
                                        ? AppColors.accent
                                        : AppColors.primary,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            selected == null
                ? 'Select a day to view deliveries'
                : 'Deliveries on ${DateFormat.yMMMd().format(DateTime.parse(selected))}',
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          if (selected == null)
            const Text(
              'Tap a date on the calendar.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            )
          else if (dayList.isEmpty)
            const Text(
              'No deliveries scheduled this day.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            )
          else
            ...dayList.map((d) {
              final po = d['purchaseOrder'];
              final poNum = po is Map
                  ? po['purchaseOrderNumber']?.toString() ?? 'PO'
                  : 'PO';
              final status = d['status']?.toString() ?? '';
              final canReschedule = isProc &&
                  status != 'Delivered' &&
                  status != 'Cancelled';
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(
                    '$poNum · ${d['timeSlot'] ?? ''}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    '${popName(d['driver'])} · ${d['deliveryAddress'] ?? ''}\n$status',
                  ),
                  isThreeLine: true,
                  trailing: canReschedule
                      ? TextButton(
                          onPressed: () => onReschedule(d),
                          child: const Text('Reschedule'),
                        )
                      : null,
                ),
              );
            }),
        ],
      ),
    );
  }
}

/// Reschedule dialog (10.8).
class _RescheduleDialog extends ConsumerStatefulWidget {
  final Map<String, dynamic> delivery;

  const _RescheduleDialog({required this.delivery});

  @override
  ConsumerState<_RescheduleDialog> createState() => _RescheduleDialogState();
}

class _RescheduleDialogState extends ConsumerState<_RescheduleDialog> {
  final _formKey = GlobalKey<FormState>();
  final _reasonCtrl = TextEditingController();
  DateTime? _newDate;
  String _timeSlot = '9 AM - 12 PM';
  bool _submitting = false;
  String? _error;

  static const _slots = ['9 AM - 12 PM', '12 PM - 3 PM', '3 PM - 6 PM'];

  @override
  void initState() {
    super.initState();
    final raw = widget.delivery['deliveryDate'];
    _newDate = DateTime.tryParse(raw?.toString() ?? '') ?? DateTime.now();
    _timeSlot = widget.delivery['timeSlot']?.toString() ?? _slots.first;
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;
    if (_newDate == null) {
      setState(() => _error = 'Select a new delivery date');
      return;
    }
    setState(() => _submitting = true);
    try {
      final dateStr =
          '${_newDate!.year.toString().padLeft(4, '0')}-'
          '${_newDate!.month.toString().padLeft(2, '0')}-'
          '${_newDate!.day.toString().padLeft(2, '0')}';
      await ref.read(apiRepositoryProvider).rescheduleDelivery(
            popId(widget.delivery),
            {
              'newDeliveryDate': dateStr,
              'timeSlot': _timeSlot,
              'reason': _reasonCtrl.text.trim(),
            },
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Delivery rescheduled successfully')),
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
    final current = widget.delivery['deliveryDate'] != null
        ? DateFormat.yMd().format(
            DateTime.tryParse(widget.delivery['deliveryDate'].toString()) ??
                DateTime.now(),
          )
        : '—';
    final original = widget.delivery['originalDeliveryDate'];
    final history = widget.delivery['rescheduleHistory'];
    final po = widget.delivery['purchaseOrder'];
    final poNum =
        po is Map ? po['purchaseOrderNumber']?.toString() ?? '' : '';

    return AlertDialog(
      title: Text('Reschedule Delivery${poNum.isEmpty ? '' : ' — $poNum'}'),
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
                  Text(
                    _error!,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'CURRENT SCHEDULE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      Text(
                        '$current · ${widget.delivery['timeSlot'] ?? ''}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      if (original != null)
                        Text(
                          'Original: ${DateFormat.yMd().format(DateTime.tryParse(original.toString()) ?? DateTime.now())}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: _submitting
                      ? null
                      : () async {
                          final now = DateTime.now();
                          final today = DateTime(now.year, now.month, now.day);
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: _newDate!.isBefore(today)
                                ? today
                                : _newDate!,
                            firstDate: today,
                            lastDate: today.add(const Duration(days: 365)),
                          );
                          if (picked != null) {
                            setState(() => _newDate = picked);
                          }
                        },
                  child: InputDecorator(
                    decoration: const InputDecoration(
                      labelText: 'New Delivery Date',
                      suffixIcon: Icon(Icons.calendar_today, size: 18),
                    ),
                    child: Text(
                      _newDate == null
                          ? 'mm/dd/yyyy'
                          : DateFormat.yMd().format(_newDate!),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _timeSlot,
                  decoration: const InputDecoration(labelText: 'Time Slot'),
                  items: _slots
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged: _submitting
                      ? null
                      : (v) {
                          if (v == null) return;
                          setState(() => _timeSlot = v);
                        },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _reasonCtrl,
                  enabled: !_submitting,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Reason for Rescheduling',
                    hintText: 'e.g. Supplier delay, site access…',
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Reason is required'
                      : null,
                ),
                if (history is List && history.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text(
                    'Reschedule history',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                  ),
                  ...history.reversed.take(5).map((h) {
                    if (h is! Map) return const SizedBox.shrink();
                    final from = h['originalDate'] != null
                        ? DateFormat.yMd().format(
                            DateTime.tryParse(h['originalDate'].toString()) ??
                                DateTime.now(),
                          )
                        : '—';
                    final to = h['newDate'] != null
                        ? DateFormat.yMd().format(
                            DateTime.tryParse(h['newDate'].toString()) ??
                                DateTime.now(),
                          )
                        : '—';
                    final when = h['changedAt'] != null
                        ? DateFormat.yMd().add_jm().format(
                              DateTime.tryParse(h['changedAt'].toString()) ??
                                  DateTime.now(),
                            )
                        : '—';
                    return Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        '$from → $to\n${h['reason'] ?? ''}\nBy ${popName(h['changedBy'])} · $when',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textSecondary,
                          height: 1.35,
                        ),
                      ),
                    );
                  }),
                ],
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
              : const Text('Confirm Reschedule'),
        ),
      ],
    );
  }
}

