import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/core/utils/media_url.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

class MaterialsScreen extends ConsumerStatefulWidget {
  const MaterialsScreen({super.key});

  @override
  ConsumerState<MaterialsScreen> createState() => _MaterialsScreenState();
}

class _MaterialsScreenState extends ConsumerState<MaterialsScreen> {
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
      final res = await ref.read(apiRepositoryProvider).getMaterials(limit: 100);
      if (mounted) setState(() => _items = res.items);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openForm({Map<String, dynamic>? existing}) async {
    List<Map<String, dynamic>> categories = [];
    List<Map<String, dynamic>> suppliers = [];
    try {
      final cats = await ref.read(apiRepositoryProvider).getCategories(limit: 100);
      suppliers = await ref.read(apiRepositoryProvider).getAllSuppliers();
      categories = cats.items;
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
      return;
    }

    if (categories.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Create a category first')),
      );
      return;
    }

    if (!mounted) return;
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _MaterialFormDialog(
        existing: existing,
        categories: categories,
        suppliers: suppliers,
      ),
    );

    if (result == null || !mounted) return;

    try {
      await ref.read(apiRepositoryProvider).saveMaterial(
        result,
        id: existing != null ? (existing['_id'] ?? existing['id']).toString() : null,
        imagePath: result['imagePath'] as String?,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(existing == null ? 'Material created' : 'Material updated'),
        ),
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
                    child: EmptyView(message: 'No materials', onAction: _load),
                  ),
                ],
              )
            : ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(0, 8, 0, 88),
                itemCount: _items.length,
                itemBuilder: (_, i) {
                  final m = _items[i];
                  final img = mediaUrl(m['image']?.toString());
                  final stock = m['currentStock'];
                  final min = m['minimumStock'];
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: ListTile(
                      onTap: () => _openForm(existing: m),
                      leading: img != null
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                img,
                                width: 48,
                                height: 48,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) =>
                                    const Icon(Icons.inventory_2),
                              ),
                            )
                          : const CircleAvatar(child: Icon(Icons.inventory_2_outlined)),
                      title: Text(
                        m['name']?.toString() ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        '${popName(m['category'])} · ${m['unit']} · \$${m['estimatedPrice']}\n'
                        'Stock: $stock (min $min)',
                      ),
                      isThreeLine: true,
                      trailing: StatusChip(m['status']?.toString() ?? 'Active'),
                    ),
                  );
                },
              ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _MaterialFormDialog extends StatefulWidget {
  final Map<String, dynamic>? existing;
  final List<Map<String, dynamic>> categories;
  final List<Map<String, dynamic>> suppliers;

  const _MaterialFormDialog({
    required this.existing,
    required this.categories,
    required this.suppliers,
  });

  @override
  State<_MaterialFormDialog> createState() => _MaterialFormDialogState();
}

class _MaterialFormDialogState extends State<_MaterialFormDialog> {
  static const _units = [
    'Bags',
    'Tons',
    'Meters',
    'Liters',
    'Units',
    'Kilograms',
  ];

  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _priceCtrl;
  late final TextEditingController _stockCtrl;
  late final TextEditingController _minStockCtrl;
  late final TextEditingController _descCtrl;

  late String _unit;
  late String _status;
  late String _categoryId;
  String? _imagePath;
  final Set<String> _selectedSuppliers = {};
  String? _error;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _nameCtrl = TextEditingController(text: existing?['name']?.toString() ?? '');
    _priceCtrl = TextEditingController(
      text: existing?['estimatedPrice']?.toString() ?? '0',
    );
    _stockCtrl = TextEditingController(
      text: existing?['currentStock']?.toString() ?? '0',
    );
    _minStockCtrl = TextEditingController(
      text: existing?['minimumStock']?.toString() ?? '50',
    );
    _descCtrl = TextEditingController(
      text: existing?['description']?.toString() ?? '',
    );

    final existingUnit = existing?['unit']?.toString() ?? 'Bags';
    _unit = _units.contains(existingUnit) ? existingUnit : 'Bags';
    _status = existing?['status']?.toString() ?? 'Active';

    final catId = popId(existing?['category']);
    _categoryId = (catId.isNotEmpty &&
            widget.categories.any((c) => popId(c) == catId))
        ? catId
        : popId(widget.categories.first);

    if (existing?['suppliers'] is List) {
      for (final s in existing!['suppliers'] as List) {
        final id = popId(s);
        if (id.isNotEmpty) _selectedSuppliers.add(id);
      }
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _priceCtrl.dispose();
    _stockCtrl.dispose();
    _minStockCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;

    if (_selectedSuppliers.isEmpty) {
      setState(() => _error = 'Select at least one supplier');
      return;
    }

    Navigator.pop(context, {
      'name': _nameCtrl.text.trim(),
      'category': _categoryId,
      'unit': _unit,
      'estimatedPrice': double.tryParse(_priceCtrl.text.trim()) ?? 0,
      'currentStock': int.tryParse(_stockCtrl.text.trim()) ?? 0,
      'minimumStock': int.tryParse(_minStockCtrl.text.trim()) ?? 0,
      'suppliers': _selectedSuppliers.toList(),
      'status': _status,
      'description': _descCtrl.text.trim(),
      'imagePath': _imagePath,
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
        widget.existing == null ? 'Define New Material' : 'Edit Material',
      ),
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
                TextFormField(
                  controller: _nameCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Stock Name',
                    hintText: 'e.g. Portland Cement Grade 43',
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Stock name is required' : null,
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: _categoryId,
                  isExpanded: true,
                  items: widget.categories
                      .map(
                        (c) => DropdownMenuItem(
                          value: popId(c),
                          child: Text(
                            c['name']?.toString() ?? '',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _categoryId = v);
                  },
                  decoration: const InputDecoration(labelText: 'Category'),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: _unit,
                  items: _units
                      .map((u) => DropdownMenuItem(value: u, child: Text(u)))
                      .toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _unit = v);
                  },
                  decoration: const InputDecoration(labelText: 'Unit of Measure'),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _priceCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Est. Unit Price (\$)',
                    hintText: 'e.g. 15.50',
                  ),
                  validator: (v) {
                    final n = double.tryParse(v?.trim() ?? '');
                    if (n == null || n < 0) return 'Enter a valid price';
                    return null;
                  },
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _stockCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Current Stock'),
                        validator: (v) {
                          final n = int.tryParse(v?.trim() ?? '');
                          if (n == null || n < 0) return 'Invalid';
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextFormField(
                        controller: _minStockCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Min. Stock Alert'),
                        validator: (v) {
                          final n = int.tryParse(v?.trim() ?? '');
                          if (n == null || n < 0) return 'Invalid';
                          return null;
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Primary Suppliers',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Select one or more suppliers for this material.',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                if (widget.suppliers.isEmpty)
                  const Text(
                    'No suppliers found',
                    style: TextStyle(color: AppColors.textSecondary),
                  )
                else
                  ...widget.suppliers.map((s) {
                    final id = popId(s);
                    final company = s['company']?.toString();
                    final name = s['name']?.toString();
                    final label = company != null && name != null
                        ? '$company ($name)'
                        : (company ?? name ?? 'Supplier');
                    return CheckboxListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(label),
                      value: _selectedSuppliers.contains(id),
                      onChanged: (v) => setState(() {
                        if (v == true) {
                          _selectedSuppliers.add(id);
                        } else {
                          _selectedSuppliers.remove(id);
                        }
                      }),
                    );
                  }),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _status,
                  items: const [
                    DropdownMenuItem(value: 'Active', child: Text('Active')),
                    DropdownMenuItem(value: 'Inactive', child: Text('Inactive')),
                  ],
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _status = v);
                  },
                  decoration: const InputDecoration(labelText: 'Status'),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _descCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Description / Specifications',
                    hintText: 'Provide technical specifications or comments…',
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: () async {
                    final picked = await ImagePicker().pickImage(
                      source: ImageSource.gallery,
                    );
                    if (picked != null && mounted) {
                      setState(() => _imagePath = picked.path);
                    }
                  },
                  icon: const Icon(Icons.image_outlined),
                  label: Text(
                    _imagePath != null ? 'Image selected' : 'Pick image (optional)',
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _submit,
          child: Text(widget.existing == null ? 'Create Material' : 'Save'),
        ),
      ],
    );
  }
}
