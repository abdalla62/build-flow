import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

class SuppliersScreen extends ConsumerStatefulWidget {
  const SuppliersScreen({super.key});

  @override
  ConsumerState<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends ConsumerState<SuppliersScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _saving = false;
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
      final res = await ref.read(apiRepositoryProvider).getSuppliers(limit: 100);
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
    if (_saving) return;
    List<Map<String, dynamic>> categories = [];
    try {
      final cats = await ref.read(apiRepositoryProvider).getCategories(limit: 100);
      categories = cats.items;
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
      return;
    }

    if (!mounted) return;
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _SupplierFormDialog(
        existing: existing,
        categories: categories,
      ),
    );

    if (result == null || !mounted) return;

    setState(() => _saving = true);
    try {
      await ref.read(apiRepositoryProvider).saveSupplier(
        result,
        id: existing != null ? (existing['_id'] ?? existing['id']).toString() : null,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            existing == null ? 'Supplier partner created' : 'Supplier updated',
          ),
        ),
      );
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
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
                    child: EmptyView(message: 'No suppliers', onAction: _load),
                  ),
                ],
              )
            : ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(0, 8, 0, 88),
                itemCount: _items.length,
                itemBuilder: (_, i) {
                  final s = _items[i];
                  final rating = (s['performanceRating'] as num?)?.toInt() ?? 0;
                  final stars = List.filled(rating.clamp(0, 5), '★').join() +
                      List.filled((5 - rating).clamp(0, 5), '☆').join();
                  return ModuleListTile(
                    title: s['company']?.toString() ?? s['name']?.toString() ?? '',
                    subtitle:
                        '${s['name']} · ${s['email']}\n${s['phone']} · $stars',
                    icon: Icons.local_shipping_outlined,
                    onTap: () => _openForm(existing: s),
                  );
                },
              ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _saving ? null : () => _openForm(),
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _SupplierFormDialog extends StatefulWidget {
  final Map<String, dynamic>? existing;
  final List<Map<String, dynamic>> categories;

  const _SupplierFormDialog({
    required this.existing,
    required this.categories,
  });

  @override
  State<_SupplierFormDialog> createState() => _SupplierFormDialogState();
}

class _SupplierFormDialogState extends State<_SupplierFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _companyCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _passwordCtrl;
  late final TextEditingController _addressCtrl;

  late int _rating;
  final Set<String> _selectedCats = {};
  bool _obscure = true;
  String? _error;

  bool get _isCreate => widget.existing == null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _nameCtrl = TextEditingController(text: e?['name']?.toString() ?? '');
    _companyCtrl = TextEditingController(text: e?['company']?.toString() ?? '');
    _phoneCtrl = TextEditingController(text: e?['phone']?.toString() ?? '');
    _emailCtrl = TextEditingController(text: e?['email']?.toString() ?? '');
    _passwordCtrl = TextEditingController();
    _addressCtrl = TextEditingController(text: e?['address']?.toString() ?? '');

    _rating = (e?['performanceRating'] as num?)?.toInt() ?? 5;
    if (_rating < 1 || _rating > 5) _rating = 5;

    if (e?['suppliedCategories'] is List) {
      for (final c in e!['suppliedCategories'] as List) {
        final id = popId(c);
        if (id.isNotEmpty) _selectedCats.add(id);
      }
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _companyCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;

    Navigator.pop(context, {
      'name': _nameCtrl.text.trim(),
      'company': _companyCtrl.text.trim(),
      'phone': _phoneCtrl.text.trim(),
      'email': _emailCtrl.text.trim(),
      'address': _addressCtrl.text.trim(),
      'paymentTerms': 'Net 30',
      'performanceRating': _rating,
      'suppliedCategories': _selectedCats.toList(),
      if (_isCreate) 'password': _passwordCtrl.text,
    });
  }

  String _ratingLabel(int value) {
    final stars = List.filled(value, '★').join();
    return '$stars ($value)';
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_isCreate ? 'Add New Supplier Partner' : 'Edit Supplier Partner'),
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
                    labelText: 'Representative Name',
                    hintText: 'e.g. John Adams',
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Name is required' : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _companyCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Company Name',
                    hintText: 'e.g. SteelCorp Ltd',
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Company is required' : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Phone Number',
                    hintText: '+1 555-0199',
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Phone is required' : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email Address',
                    hintText: 'sales@steelcorp.com',
                  ),
                  validator: (v) {
                    final value = v?.trim() ?? '';
                    if (value.isEmpty) return 'Email is required';
                    if (!value.contains('@') || !value.contains('.')) {
                      return 'Enter a valid email';
                    }
                    return null;
                  },
                ),
                if (_isCreate) ...[
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _passwordCtrl,
                    obscureText: _obscure,
                    decoration: InputDecoration(
                      labelText: 'Login Password',
                      hintText: 'Min. 6 characters',
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => _obscure = !_obscure),
                        icon: Icon(
                          _obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Password is required';
                      if (v.length < 6) return 'Password must be at least 6 characters';
                      return null;
                    },
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Used for supplier login. Account will also appear under Users.',
                    style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),
                ],
                const SizedBox(height: 10),
                TextFormField(
                  controller: _addressCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Address',
                    hintText: 'e.g. 100 Industrial Pkwy, Suite B',
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Address is required' : null,
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<int>(
                  value: _rating,
                  items: [5, 4, 3, 2, 1]
                      .map(
                        (r) => DropdownMenuItem(
                          value: r,
                          child: Text(_ratingLabel(r)),
                        ),
                      )
                      .toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _rating = v);
                  },
                  decoration: const InputDecoration(
                    labelText: 'Performance Rating (1-5)',
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Supplied Categories',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                ),
                const SizedBox(height: 6),
                if (widget.categories.isEmpty)
                  const Text(
                    'No categories found',
                    style: TextStyle(color: AppColors.textSecondary),
                  )
                else
                  Container(
                    constraints: const BoxConstraints(maxHeight: 160),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: ListView(
                      shrinkWrap: true,
                      children: widget.categories.map((c) {
                        final id = popId(c);
                        return CheckboxListTile(
                          dense: true,
                          title: Text(c['name']?.toString() ?? ''),
                          value: _selectedCats.contains(id),
                          onChanged: (v) => setState(() {
                            if (v == true) {
                              _selectedCats.add(id);
                            } else {
                              _selectedCats.remove(id);
                            }
                          }),
                        );
                      }).toList(),
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
          child: Text(_isCreate ? 'Create Supplier Partner' : 'Save Changes'),
        ),
      ],
    );
  }
}
