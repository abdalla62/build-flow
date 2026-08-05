import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  List<Map<String, dynamic>> _materials = [];
  List<Map<String, dynamic>> _ledger = [];
  List<Map<String, dynamic>> _alerts = [];
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
      final api = ref.read(apiRepositoryProvider);
      final materials = await api.getMaterials(limit: 100);
      final ledger = await api.getInventoryLedger(limit: 50);
      final alerts = await api.getInventoryAlerts();
      if (mounted) {
        setState(() {
          _materials = materials.items;
          _ledger = ledger.items;
          _alerts = alerts;
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

  Future<void> _adjust() async {
    final materials = _materials.isNotEmpty
        ? _materials
        : (await ref.read(apiRepositoryProvider).getMaterials(limit: 100))
            .items;
    if (!mounted || materials.isEmpty) return;

    String? materialId = popId(materials.first);
    final qty = TextEditingController(text: '1');
    String type = 'Stock In';
    final comments = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Adjust Stock'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              initialValue: materialId,
              isExpanded: true,
              items: materials
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
              onChanged: (v) => materialId = v,
              decoration: const InputDecoration(labelText: 'Material'),
            ),
            TextField(
              controller: qty,
              decoration: const InputDecoration(labelText: 'Quantity'),
              keyboardType: TextInputType.number,
            ),
            DropdownButtonFormField<String>(
              initialValue: type,
              items: [
                'Stock In',
                'Stock Out',
              ].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
              onChanged: (v) => type = v ?? type,
              decoration: const InputDecoration(labelText: 'Type'),
            ),
            TextField(
              controller: comments,
              decoration: const InputDecoration(labelText: 'Remarks'),
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
            child: const Text('Adjust'),
          ),
        ],
      ),
    );
    if (ok != true || materialId == null) return;

    try {
      await ref.read(apiRepositoryProvider).adjustStock({
        'material': materialId,
        'quantity': int.tryParse(qty.text) ?? 1,
        'type': type,
        'comments': comments.text,
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

  @override
  Widget build(BuildContext context) {
    final isAdmin = ref.watch(authNotifierProvider).state.user?.isAdmin == true;
    final dark = Theme.of(context).brightness == Brightness.dark;

    if (_loading) return const LoadingView(message: 'Loading inventory…');
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 28),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Text(
                'Inventory Controls',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                'View stock balances and post manual adjustments. Add/edit products under Materials.',
                style: TextStyle(
                  fontSize: 12.5,
                  color: dark ? Colors.white70 : AppColors.textSecondary,
                ),
              ),
            ),
            if (_alerts.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Text(
                  'Low Stock Alerts',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.danger,
                  ),
                ),
              ),
              ..._alerts.map(
                (a) => Card(
                  margin: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 4,
                  ),
                  color: AppColors.danger.withValues(alpha: 0.06),
                  child: ListTile(
                    leading: const Icon(
                      Icons.warning_amber,
                      color: AppColors.danger,
                    ),
                    title: Text(popName(a['material'] ?? a)),
                    subtitle: Text(
                      'Stock: ${a['currentStock']} / Min: ${a['minimumStock']}',
                    ),
                  ),
                ),
              ),
            ],
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text(
                'Catalog Stock Balances',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            if (_materials.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Text('No materials in catalog'),
              )
            else
              ..._materials.map((m) {
                final stock = m['currentStock'] ?? 0;
                final min = m['minimumStock'] ?? 0;
                final unit = m['unit']?.toString() ?? '';
                final low = (stock is num ? stock : 0) <=
                    (min is num ? min : 0);
                return Card(
                  margin: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 4,
                  ),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor:
                          AppColors.primary.withValues(alpha: 0.12),
                      child: const Icon(
                        Icons.inventory_2_outlined,
                        color: AppColors.primary,
                        size: 20,
                      ),
                    ),
                    title: Text(
                      m['name']?.toString() ?? '—',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(popName(m['category'])),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '$stock $unit',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: low ? AppColors.danger : null,
                          ),
                        ),
                        Text(
                          'Min $min',
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
                );
              }),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text(
                'Ledger Activity Log',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            if (_ledger.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Text('No ledger entries yet'),
              )
            else
              ..._ledger.map(
                (l) => ModuleListTile(
                  title: popName(l['material']),
                  subtitle: '${l['type']} · Qty ${l['quantity']}',
                  icon: Icons.inventory_outlined,
                ),
              ),
          ],
        ),
      ),
      floatingActionButton: isAdmin
          ? FloatingActionButton(
              onPressed: _adjust,
              child: const Icon(Icons.tune),
            )
          : null,
    );
  }
}
