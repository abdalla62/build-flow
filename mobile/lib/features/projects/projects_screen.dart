import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

class ProjectsScreen extends ConsumerStatefulWidget {
  const ProjectsScreen({super.key});

  @override
  ConsumerState<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends ConsumerState<ProjectsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String _statusFilter = '';

  bool get _isAdmin =>
      ref.read(authNotifierProvider).state.user?.isAdmin == true;

  List<String> get _statusFilterOptions => _isAdmin
      ? const ['Pending', 'Active', 'Completed', 'On Hold']
      : const ['Pending', 'Active'];

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
      final res = await ref.read(apiRepositoryProvider).getProjects(
            limit: 50,
            status: _statusFilter.isEmpty ? null : _statusFilter,
          );
      if (mounted) setState(() => _items = res.items);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save({Map<String, dynamic>? existing}) async {
    if (_saving) return;
    final nameCtrl = TextEditingController(text: existing?['name']?.toString() ?? '');
    final locationCtrl = TextEditingController(text: existing?['location']?.toString() ?? '');
    final budgetCtrl = TextEditingController(text: existing?['budget']?.toString() ?? '0');
    String status = existing?['status']?.toString() ?? 'Pending';
    String managerId = popId(existing?['manager']);

    List<Map<String, dynamic>> managers = [];
    try {
      final users = await ref.read(apiRepositoryProvider).getUsers(limit: 100);
      managers = users.items
          .where((u) {
            final role = u['role']?.toString();
            final active = u['status']?.toString() == 'Active';
            return active && (role == 'Project Manager' || role == 'Administrator');
          })
          .toList();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
      return;
    }

    if (managers.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No active Project Manager found. Create/activate a PM user first.'),
        ),
      );
      return;
    }

    if (managerId.isEmpty || !managers.any((m) => popId(m) == managerId)) {
      managerId = popId(managers.first);
    }

    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              title: Text(existing == null ? 'New Project' : 'Edit Project'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(labelText: 'Name'),
                      textCapitalization: TextCapitalization.words,
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: locationCtrl,
                      decoration: const InputDecoration(labelText: 'Location'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: budgetCtrl,
                      decoration: const InputDecoration(labelText: 'Budget'),
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: managerId,
                      isExpanded: true,
                      items: managers.map((m) {
                        final id = popId(m);
                        final name = m['name']?.toString() ?? 'Manager';
                        final role = m['role']?.toString() ?? '';
                        return DropdownMenuItem(
                          value: id,
                          child: Text(
                            '$name ($role)',
                            overflow: TextOverflow.ellipsis,
                          ),
                        );
                      }).toList(),
                      onChanged: (v) {
                        if (v == null) return;
                        setDialogState(() => managerId = v);
                      },
                      decoration: const InputDecoration(
                        labelText: 'Assigned Project Manager',
                      ),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: status,
                      items: [
                        const DropdownMenuItem(value: 'Pending', child: Text('Pending')),
                        const DropdownMenuItem(value: 'Active', child: Text('Active')),
                        if (existing != null && _isAdmin) ...const [
                          DropdownMenuItem(value: 'Completed', child: Text('Completed')),
                          DropdownMenuItem(value: 'On Hold', child: Text('On Hold')),
                        ],
                      ],
                      onChanged: (v) {
                        if (v == null) return;
                        setDialogState(() => status = v);
                      },
                      decoration: const InputDecoration(labelText: 'Status'),
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
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );

    final name = nameCtrl.text.trim();
    final location = locationCtrl.text.trim();
    final budget = double.tryParse(budgetCtrl.text.trim()) ?? 0;
    nameCtrl.dispose();
    locationCtrl.dispose();
    budgetCtrl.dispose();

    if (ok != true) return;

    if (name.isEmpty || location.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name and location are required')),
      );
      return;
    }
    if (managerId.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please assign a project manager')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      await ref.read(apiRepositoryProvider).saveProject(
        {
          'name': name,
          'location': location,
          'budget': budget,
          'manager': managerId,
          'status': status,
        },
        id: existing != null ? (existing['_id'] ?? existing['id']).toString() : null,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(existing == null ? 'Project created' : 'Project updated'),
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

    final isAdmin = ref.watch(authNotifierProvider).state.user?.isAdmin == true;

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: DropdownButtonFormField<String>(
              key: ValueKey('project-status-$_statusFilter-$isAdmin'),
              initialValue: _statusFilter,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Status',
                isDense: true,
              ),
              items: [
                const DropdownMenuItem(value: '', child: Text('All Statuses')),
                ..._statusFilterOptions.map(
                  (s) => DropdownMenuItem(value: s, child: Text(s)),
                ),
              ],
              onChanged: (v) {
                setState(() => _statusFilter = v ?? '');
                _load();
              },
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(
                          height: 240,
                          child: EmptyView(message: 'No projects', onAction: _load),
                        ),
                      ],
                    )
                  : ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(0, 8, 0, 88),
                      itemCount: _items.length,
                      itemBuilder: (_, i) {
                        final p = _items[i];
                        final managerName = popName(p['manager'], 'Unassigned');
                        return ModuleListTile(
                          title: p['name']?.toString() ?? '',
                          subtitle:
                              '${p['location']} · Budget: ${p['budget']}\nPM: $managerName',
                          status: p['status']?.toString(),
                          icon: Icons.work_outline,
                          onTap: isAdmin ? () => _save(existing: p) : null,
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
      floatingActionButton: ref.watch(authNotifierProvider).state.user?.isAdmin == true
          ? FloatingActionButton(
              onPressed: _saving ? null : () => _save(),
              child: _saving
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add),
            )
          : null,
    );
  }
}
