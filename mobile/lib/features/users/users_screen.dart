import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:construction_material_mobile_app/core/theme/app_scroll_behavior.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

class UsersScreen extends ConsumerStatefulWidget {
  const UsersScreen({super.key});

  @override
  ConsumerState<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends ConsumerState<UsersScreen> {
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();

  List<Map<String, dynamic>> _items = [];
  List<String> _roles = const [];
  bool _loading = true;
  String? _error;
  int _page = 1;
  int _totalPages = 1;
  int _total = 0;
  String _roleFilter = '';
  String? _busyUserId;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    try {
      final roles = await ref.read(apiRepositoryProvider).getUserRoles();
      if (mounted && roles.isNotEmpty) setState(() => _roles = roles);
    } catch (_) {}
    await _load();
  }

  Future<void> _load({bool resetPage = false}) async {
    if (resetPage) _page = 1;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiRepositoryProvider).getUsers(
            page: _page,
            limit: 50,
            search: _searchCtrl.text.trim(),
            role: _roleFilter.isEmpty ? null : _roleFilter,
          );
      if (!mounted) return;
      setState(() {
        _items = res.items;
        _totalPages = res.totalPages < 1 ? 1 : res.totalPages;
        _total = res.total;
        _page = res.currentPage;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleStatus(Map<String, dynamic> user) async {
    final id = (user['_id'] ?? user['id']).toString();
    final name = user['name']?.toString() ?? 'this user';
    final next = user['status'] == 'Active' ? 'Inactive' : 'Active';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(next == 'Active' ? 'Activate user?' : 'Deactivate user?'),
        content: Text(
          next == 'Active'
              ? 'Mark $name as Active so they can sign in?'
              : 'Mark $name as Inactive? They will not be able to sign in.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(next == 'Active' ? 'Activate' : 'Deactivate'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busyUserId = id);
    try {
      await ref.read(apiRepositoryProvider).updateUserStatus(id, next);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('User marked as $next')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _busyUserId = null);
    }
  }

  Future<void> _editRole(Map<String, dynamic> user) async {
    final updated = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _EditUserRoleDialog(user: user, roles: _roles),
    );
    if (updated == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Role updated successfully')),
      );
      await _load();
    }
  }

  Future<void> _deleteUser(Map<String, dynamic> user) async {
    final id = (user['_id'] ?? user['id']).toString();
    final name = user['name']?.toString() ?? 'this user';
    final email = user['email']?.toString() ?? '';
    final meId = ref.read(authNotifierProvider).state.user?.id;

    if (meId != null && meId == id) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot delete your own account')),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete user?'),
        content: Text(
          'Delete $name ($email)? This cannot be undone.',
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
    if (confirmed != true) return;

    setState(() => _busyUserId = id);
    try {
      await ref.read(apiRepositoryProvider).deleteUser(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('User deleted successfully')),
      );
      // If last item on page, go back a page when possible.
      if (_items.length <= 1 && _page > 1) {
        setState(() => _page -= 1);
      }
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _busyUserId = null);
    }
  }

  Future<void> _createUser() async {
    final created = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const _CreateUserDialog(),
    );
    if (created == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('User created successfully')),
      );
      await _load(resetPage: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    // No nested Scaffold — AppShell already provides one (nested Scaffolds break scroll).
    return Stack(
      children: [
        Scrollbar(
          controller: _scrollCtrl,
          interactive: true,
          thickness: 4,
          radius: const Radius.circular(8),
          child: RefreshIndicator(
            onRefresh: () async {
              await _load();
            },
            child: CustomScrollView(
              controller: _scrollCtrl,
              primary: false,
              physics: kAppScrollPhysics,
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              slivers: [
                SliverToBoxAdapter(
                  child: _UsersFilters(
                    searchCtrl: _searchCtrl,
                    roles: _roles,
                    roleFilter: _roleFilter,
                    total: _total,
                    onSearch: () => _load(resetPage: true),
                    onRoleChanged: (role) {
                      setState(() => _roleFilter = role);
                      _load(resetPage: true);
                    },
                    onClear: () {
                      _searchCtrl.clear();
                      setState(() => _roleFilter = '');
                      _load(resetPage: true);
                    },
                  ),
                ),
                ..._buildSlivers(),
                const SliverToBoxAdapter(child: SizedBox(height: 120)),
              ],
            ),
          ),
        ),
        Positioned(
          right: 16,
          bottom: 16,
          child: SafeArea(
            child: FloatingActionButton.extended(
              onPressed: _createUser,
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text('Add User'),
            ),
          ),
        ),
      ],
    );
  }

  List<Widget> _buildSlivers() {
    if (_loading) {
      return [
        const SliverFillRemaining(
          hasScrollBody: false,
          child: LoadingView(),
        ),
      ];
    }
    if (_error != null) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: ErrorView(message: _error!, onRetry: _load),
        ),
      ];
    }
    if (_items.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: EmptyView(
            message: 'No users match your filters',
            onAction: () => _load(resetPage: true),
            actionLabel: 'Refresh',
          ),
        ),
      ];
    }

    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
        sliver: SliverList.builder(
          itemCount: _items.length,
          itemBuilder: (_, i) {
            final u = _items[i];
            final id = (u['_id'] ?? u['id']).toString();
            final meId = ref.watch(authNotifierProvider).state.user?.id;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _UserCard(
                user: u,
                busy: _busyUserId == id,
                isSelf: meId != null && meId == id,
                onEditRole: () => _editRole(u),
                onToggleStatus: () => _toggleStatus(u),
                onDelete: () => _deleteUser(u),
              ),
            );
          },
        ),
      ),
      if (_totalPages > 1)
        SliverToBoxAdapter(
          child: _PaginationBar(
            page: _page,
            totalPages: _totalPages,
            onPrev: _page <= 1
                ? null
                : () {
                    setState(() => _page -= 1);
                    _load();
                  },
            onNext: _page >= _totalPages
                ? null
                : () {
                    setState(() => _page += 1);
                    _load();
                  },
          ),
        ),
    ];
  }
}

class _UsersFilters extends StatelessWidget {
  final TextEditingController searchCtrl;
  final List<String> roles;
  final String roleFilter;
  final int total;
  final VoidCallback onSearch;
  final ValueChanged<String> onRoleChanged;
  final VoidCallback onClear;

  const _UsersFilters({
    required this.searchCtrl,
    required this.roles,
    required this.roleFilter,
    required this.total,
    required this.onSearch,
    required this.onRoleChanged,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'User Management',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$total users',
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: searchCtrl,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => onSearch(),
              decoration: InputDecoration(
                hintText: 'Search name or email…',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  tooltip: 'Search',
                  onPressed: onSearch,
                  icon: const Icon(Icons.arrow_forward),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    key: ValueKey('role-filter-$roleFilter'),
                    initialValue: roleFilter,
                    isExpanded: true,
                    items: [
                      const DropdownMenuItem(value: '', child: Text('All roles')),
                      ...roles.map((r) => DropdownMenuItem(value: r, child: Text(r))),
                    ],
                    onChanged: (v) => onRoleChanged(v ?? ''),
                    decoration: const InputDecoration(
                      labelText: 'Filter by role',
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: onClear,
                  child: const Text('Clear'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PaginationBar extends StatelessWidget {
  final int page;
  final int totalPages;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  const _PaginationBar({
    required this.page,
    required this.totalPages,
    required this.onPrev,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
        child: Row(
          children: [
            IconButton.filledTonal(
              onPressed: onPrev,
              icon: const Icon(Icons.chevron_left),
              tooltip: 'Previous page',
            ),
            Expanded(
              child: Text(
                'Page $page / $totalPages',
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            IconButton.filledTonal(
              onPressed: onNext,
              icon: const Icon(Icons.chevron_right),
              tooltip: 'Next page',
            ),
          ],
        ),
      ),
    );
  }
}

class _UserCard extends StatelessWidget {
  final Map<String, dynamic> user;
  final bool busy;
  final bool isSelf;
  final VoidCallback onEditRole;
  final VoidCallback onToggleStatus;
  final VoidCallback onDelete;

  const _UserCard({
    required this.user,
    required this.busy,
    required this.isSelf,
    required this.onEditRole,
    required this.onToggleStatus,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final name = user['name']?.toString() ?? '—';
    final email = user['email']?.toString() ?? '';
    final role = user['role']?.toString() ?? '';
    final status = user['status']?.toString() ?? '';
    final initial = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : '?';
    final isActive = status == 'Active';

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  foregroundColor: AppColors.primary,
                  child: Text(initial, style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                            ),
                          ),
                          if (isSelf)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.accent.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: const Text(
                                'You',
                                style: TextStyle(
                                  color: AppColors.accent,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        email,
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.secondary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              role,
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          StatusChip(status),
                        ],
                      ),
                    ],
                  ),
                ),
                if (busy)
                  const Padding(
                    padding: EdgeInsets.all(8),
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                else
                  IconButton(
                    tooltip: isSelf ? 'Cannot delete your own account' : 'Delete user',
                    onPressed: isSelf ? null : onDelete,
                    icon: Icon(
                      Icons.delete_outline,
                      color: isSelf ? AppColors.textSecondary : AppColors.danger,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: busy ? null : onEditRole,
                    icon: const Icon(Icons.shield_outlined, size: 18),
                    label: const Text('Edit role'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: busy ? null : onToggleStatus,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isActive ? AppColors.danger : AppColors.success,
                    ),
                    icon: Icon(
                      isActive ? Icons.person_off_outlined : Icons.person_outline,
                      size: 18,
                    ),
                    label: Text(isActive ? 'Deactivate' : 'Activate'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EditUserRoleDialog extends ConsumerStatefulWidget {
  final Map<String, dynamic> user;
  final List<String> roles;

  const _EditUserRoleDialog({required this.user, required this.roles});

  @override
  ConsumerState<_EditUserRoleDialog> createState() => _EditUserRoleDialogState();
}

class _EditUserRoleDialogState extends ConsumerState<_EditUserRoleDialog> {
  final _formKey = GlobalKey<FormState>();
  final _plateCtrl = TextEditingController();

  late String _role;
  late List<String> _roles;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _roles = widget.roles.isNotEmpty
        ? List.of(widget.roles)
        : const [
            'Administrator',
            'Procurement Officer',
            'Project Manager',
            'Site Engineer',
            'Supplier',
            'Accountant',
            'Delivery Staff',
          ];
    final current = widget.user['role']?.toString() ?? _roles.first;
    _role = _roles.contains(current) ? current : _roles.first;
    _plateCtrl.text = widget.user['vehiclePlateCode']?.toString() ?? '';
  }

  @override
  void dispose() {
    _plateCtrl.dispose();
    super.dispose();
  }

  bool get _isDelivery => _role == 'Delivery Staff';

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;

    final id = (widget.user['_id'] ?? widget.user['id']).toString();
    setState(() => _submitting = true);
    try {
      await ref.read(apiRepositoryProvider).updateUserRole(
            id,
            role: _role,
            vehiclePlateCode: _isDelivery ? _plateCtrl.text.trim() : '',
          );
      if (!mounted) return;
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
    final name = widget.user['name']?.toString() ?? 'User';
    final email = widget.user['email']?.toString() ?? '';

    return AlertDialog(
      title: const Text('Edit Role'),
      content: SizedBox(
        width: 400,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(email, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                const SizedBox(height: 14),
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.danger.withValues(alpha: 0.35)),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                DropdownButtonFormField<String>(
                  initialValue: _role,
                  items: _roles
                      .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                      .toList(),
                  onChanged: _submitting
                      ? null
                      : (v) {
                          if (v == null) return;
                          setState(() => _role = v);
                        },
                  decoration: const InputDecoration(labelText: 'Role'),
                ),
                if (_isDelivery) ...[
                  const SizedBox(height: 12),
                  Text(
                    'Driver information',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _plateCtrl,
                    enabled: !_submitting,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      labelText: 'Vehicle Plate Code',
                      hintText: 'e.g. TRK-4820',
                      helperText:
                          'Each driver must have a unique plate. Two staff cannot share the same vehicle.',
                      helperMaxLines: 2,
                    ),
                    validator: (v) {
                      if (!_isDelivery) return null;
                      return (v == null || v.trim().isEmpty) ? 'Plate code is required' : null;
                    },
                  ),
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
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text('Save'),
        ),
      ],
    );
  }
}

class _CreateUserDialog extends ConsumerStatefulWidget {
  const _CreateUserDialog();

  @override
  ConsumerState<_CreateUserDialog> createState() => _CreateUserDialogState();
}

class _CreateUserDialogState extends ConsumerState<_CreateUserDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _pwCtrl = TextEditingController();
  final _plateCtrl = TextEditingController();

  static const _fallbackRoles = [
    'Administrator',
    'Procurement Officer',
    'Project Manager',
    'Site Engineer',
    'Supplier',
    'Accountant',
    'Delivery Staff',
  ];

  List<String> _roles = List.of(_fallbackRoles);
  String _role = 'Site Engineer';
  String _status = 'Active';
  bool _loadingRoles = true;
  bool _submitting = false;
  String? _error;
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    _loadRoles();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _pwCtrl.dispose();
    _plateCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadRoles() async {
    try {
      final fetched = await ref.read(apiRepositoryProvider).getUserRoles();
      if (!mounted) return;
      setState(() {
        if (fetched.isNotEmpty) _roles = fetched;
        _role = _roles.contains('Site Engineer') ? 'Site Engineer' : _roles.first;
        _loadingRoles = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingRoles = false);
    }
  }

  bool get _isDelivery => _role == 'Delivery Staff';

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      final body = <String, dynamic>{
        'name': _nameCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'password': _pwCtrl.text,
        'role': _role,
        'status': _status,
      };
      if (_isDelivery) {
        body['vehiclePlateCode'] = _plateCtrl.text.trim();
      }

      await ref.read(apiRepositoryProvider).createUser(body);
      if (!mounted) return;
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
      title: const Text('Add New Employee'),
      content: SizedBox(
        width: 400,
        child: _loadingRoles
            ? const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator()),
              )
            : Form(
                key: _formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) ...[
                        Container(
                          padding: const EdgeInsets.all(10),
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
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      TextFormField(
                        controller: _nameCtrl,
                        textCapitalization: TextCapitalization.words,
                        enabled: !_submitting,
                        decoration: const InputDecoration(
                          labelText: 'Full Name',
                          hintText: 'e.g. John Doe',
                        ),
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Full name is required' : null,
                      ),
                      const SizedBox(height: 10),
                      TextFormField(
                        controller: _emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        enabled: !_submitting,
                        decoration: const InputDecoration(
                          labelText: 'Email Address',
                          hintText: 'name@buildflow.com',
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
                      const SizedBox(height: 10),
                      TextFormField(
                        controller: _pwCtrl,
                        obscureText: _obscure,
                        enabled: !_submitting,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          hintText: 'Min 6 characters',
                          suffixIcon: IconButton(
                            onPressed: _submitting
                                ? null
                                : () => setState(() => _obscure = !_obscure),
                            icon: Icon(
                              _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            ),
                          ),
                        ),
                        validator: (v) {
                          if (v == null || v.isEmpty) return 'Password is required';
                          if (v.length < 6) return 'Password must be at least 6 characters';
                          return null;
                        },
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              initialValue: _role,
                              items: _roles
                                  .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                                  .toList(),
                              onChanged: _submitting
                                  ? null
                                  : (v) {
                                      if (v == null) return;
                                      setState(() => _role = v);
                                    },
                              decoration: const InputDecoration(labelText: 'Role'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              initialValue: _status,
                              items: const [
                                DropdownMenuItem(value: 'Active', child: Text('Active')),
                                DropdownMenuItem(value: 'Inactive', child: Text('Inactive')),
                              ],
                              onChanged: _submitting
                                  ? null
                                  : (v) {
                                      if (v == null) return;
                                      setState(() => _status = v);
                                    },
                              decoration: const InputDecoration(labelText: 'Status'),
                            ),
                          ),
                        ],
                      ),
                      if (_isDelivery) ...[
                        const SizedBox(height: 14),
                        Text(
                          'Driver information',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: AppColors.primary,
                              ),
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _plateCtrl,
                          enabled: !_submitting,
                          textCapitalization: TextCapitalization.characters,
                          decoration: const InputDecoration(
                            labelText: 'Vehicle Plate Code',
                            hintText: 'e.g. TRK-4820',
                            helperText:
                                'Each driver must have a unique plate. Two staff cannot share the same vehicle.',
                            helperMaxLines: 2,
                          ),
                          validator: (v) {
                            if (!_isDelivery) return null;
                            return (v == null || v.trim().isEmpty)
                                ? 'Plate code is required'
                                : null;
                          },
                        ),
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
          onPressed: (_loadingRoles || _submitting) ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text('Create'),
        ),
      ],
    );
  }
}
