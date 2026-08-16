import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';

class SiteStockScreen extends ConsumerStatefulWidget {
  const SiteStockScreen({super.key});

  @override
  ConsumerState<SiteStockScreen> createState() => _SiteStockScreenState();
}

class _SiteStockScreenState extends ConsumerState<SiteStockScreen> {
  List<Map<String, dynamic>> _stocks = [];
  List<Map<String, dynamic>> _projects = [];
  String? _projectFilter;
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
      final result = await ref.read(apiRepositoryProvider).getProjectStock(
            projectId: _projectFilter,
          );
      if (!mounted) return;
      setState(() {
        _stocks = result.stocks;
        _projects = result.projects;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openUsage(Map<String, dynamic> row) async {
    final material = row['material'] is Map
        ? Map<String, dynamic>.from(row['material'] as Map)
        : <String, dynamic>{};
    final project = row['project'] is Map
        ? Map<String, dynamic>.from(row['project'] as Map)
        : <String, dynamic>{};
    final onSite = (row['quantity'] as num?)?.toInt() ?? 0;
    final unit = material['unit']?.toString() ?? '';
    if (onSite < 1) return;

    final qtyCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();
    var submitting = false;

    await showDialog<void>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return AlertDialog(
              title: const Text('Record site usage'),
              content: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      material['name']?.toString() ?? 'Material',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      '${project['name'] ?? 'Project'}'
                      '${project['location'] != null ? ' · ${project['location']}' : ''}',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'On site: $onSite $unit',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: qtyCtrl,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'Quantity used',
                        hintText: 'e.g. 2 (of $onSite)',
                      ),
                      validator: (v) {
                        final n = int.tryParse(v?.trim() ?? '');
                        if (n == null || n < 1) {
                          return 'Enter at least 1';
                        }
                        if (n > onSite) return 'Only $onSite on site';
                        return null;
                      },
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: notesCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Note (optional)',
                      ),
                      maxLength: 500,
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: submitting ? null : () => Navigator.pop(ctx),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: submitting
                      ? null
                      : () async {
                          if (!formKey.currentState!.validate()) return;
                          final qty = int.parse(qtyCtrl.text.trim());
                          setLocal(() => submitting = true);
                          try {
                            await ref.read(apiRepositoryProvider).recordSiteUsage({
                              'project': project['_id']?.toString() ??
                                  row['project']?.toString(),
                              'material': material['_id']?.toString() ??
                                  row['material']?.toString(),
                              'quantity': qty,
                              if (notesCtrl.text.trim().isNotEmpty)
                                'notes': notesCtrl.text.trim(),
                            });
                            if (ctx.mounted) Navigator.pop(ctx);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    'Recorded $qty $unit used — remaining ${onSite - qty}',
                                  ),
                                ),
                              );
                              _load();
                            }
                          } catch (e) {
                            setLocal(() => submitting = false);
                            if (ctx.mounted) {
                              ScaffoldMessenger.of(ctx).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    e.toString().replaceFirst('Exception: ', ''),
                                  ),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                            }
                          }
                        },
                  child: Text(submitting ? 'Saving…' : 'Confirm usage'),
                ),
              ],
            );
          },
        );
      },
    );

    qtyCtrl.dispose();
    notesCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Site Stock',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Material on your project sites. Tap Record usage when materials are used.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
            if (_projects.isNotEmpty) ...[
              const SizedBox(height: 16),
              DropdownButtonFormField<String?>(
                initialValue: _projectFilter,
                decoration: const InputDecoration(labelText: 'Project'),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('All my projects'),
                  ),
                  ..._projects.map(
                    (p) => DropdownMenuItem<String?>(
                      value: p['_id']?.toString(),
                      child: Text(p['name']?.toString() ?? 'Project'),
                    ),
                  ),
                ],
                onChanged: (v) {
                  setState(() => _projectFilter = v);
                  _load();
                },
              ),
            ],
            const SizedBox(height: 16),
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_error != null)
              Text(_error!, style: const TextStyle(color: AppColors.danger))
            else if (_stocks.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Text(
                  'No site stock yet. It appears when deliveries arrive at your project.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              )
            else
              ..._stocks.map((row) {
                final material = row['material'] is Map
                    ? Map<String, dynamic>.from(row['material'] as Map)
                    : <String, dynamic>{};
                final project = row['project'] is Map
                    ? Map<String, dynamic>.from(row['project'] as Map)
                    : <String, dynamic>{};
                final qty = row['quantity'];
                final unit = material['unit']?.toString() ?? '';
                final onSite = (qty as num?)?.toInt() ?? 0;
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: const CircleAvatar(
                      child: Icon(Icons.inventory_2_outlined),
                    ),
                    title: Text(
                      material['name']?.toString() ?? 'Material',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${project['name'] ?? 'Project'}'
                          '${project['location'] != null ? ' · ${project['location']}' : ''}',
                        ),
                        if (onSite > 0)
                          TextButton.icon(
                            onPressed: () => _openUsage(row),
                            icon: const Icon(Icons.remove_circle_outline, size: 18),
                            label: const Text('Record usage'),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                      ],
                    ),
                    isThreeLine: onSite > 0,
                    trailing: Text(
                      '$qty $unit',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
