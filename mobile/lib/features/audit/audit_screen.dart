import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:construction_material_mobile_app/core/theme/app_scroll_behavior.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

/// Feature 10.9 — matches web Audit Security Logs (search, role filter, pages, CSV).
class AuditScreen extends ConsumerStatefulWidget {
  const AuditScreen({super.key});

  @override
  ConsumerState<AuditScreen> createState() => _AuditScreenState();
}

class _AuditScreenState extends ConsumerState<AuditScreen> {
  static const _roles = <String>[
    '',
    'Administrator',
    'Procurement Officer',
    'Project Manager',
    'Site Engineer',
    'Supplier',
    'Accountant',
    'Delivery Staff',
  ];

  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;
  String _roleFilter = '';
  int _page = 1;
  int _totalPages = 1;
  bool _exporting = false;

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
      final res = await ref.read(apiRepositoryProvider).getAuditLogs(
            page: _page,
            limit: 15,
            search: _searchCtrl.text.trim(),
            role: _roleFilter.isEmpty ? null : _roleFilter,
          );
      if (mounted) {
        setState(() {
          _items = res.items;
          _totalPages = res.totalPages < 1 ? 1 : res.totalPages;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e.toString().replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _exportCsv() async {
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No audit records to export')),
      );
      return;
    }
    setState(() => _exporting = true);
    try {
      final buf = StringBuffer();
      buf.writeln(
        'Timestamp,UserName,UserEmail,Role,Action,Details,IP Address,User Agent',
      );
      for (final log in _items) {
        final ts = log['createdAt'] != null
            ? DateFormat.yMd().add_jm().format(
                  DateTime.tryParse(log['createdAt'].toString())?.toLocal() ??
                      DateTime.now(),
                )
            : '';
        String esc(dynamic v) {
          final s = (v ?? '').toString().replaceAll('"', '""');
          return '"$s"';
        }

        buf.writeln(
          [
            esc(ts),
            esc(log['userName']),
            esc(log['userEmail']),
            esc(log['role']),
            esc(log['action']),
            esc(log['details']),
            esc(log['ipAddress'] ?? 'Unknown'),
            esc(log['userAgent'] ?? 'Unknown'),
          ].join(','),
        );
      }

      final dir = await getTemporaryDirectory();
      final day = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final file = File('${dir.path}/audit_logs_$day.csv');
      await file.writeAsString(buf.toString(), flush: true);
      await SharePlus.instance.share(
        ShareParams(files: [XFile(file.path)], text: 'Audit logs'),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    if (_loading && _items.isEmpty) {
      return const LoadingView(message: 'Loading audit logs…');
    }
    if (_error != null && _items.isEmpty) {
      return ErrorView(message: _error!, onRetry: _load);
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: kAppScrollPhysics,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          Text(
            'Audit Security Logs',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            'Monitor system actions, staff changes, and authorization events.',
            style: TextStyle(
              fontSize: 12.5,
              color: dark ? Colors.white70 : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: _exporting ? null : _exportCsv,
              icon: const Icon(Icons.download_outlined, size: 18),
              label: Text(_exporting ? 'Exporting…' : 'Export CSV'),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchCtrl,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              labelText: 'Search email, details, or name',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: IconButton(
                icon: const Icon(Icons.arrow_forward),
                onPressed: () {
                  setState(() => _page = 1);
                  _load();
                },
              ),
            ),
            onSubmitted: (_) {
              setState(() => _page = 1);
              _load();
            },
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            key: ValueKey('role-$_roleFilter'),
            initialValue: _roleFilter,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Account Role'),
            items: _roles
                .map(
                  (r) => DropdownMenuItem(
                    value: r,
                    child: Text(r.isEmpty ? 'All Roles' : r),
                  ),
                )
                .toList(),
            onChanged: (v) {
              setState(() {
                _roleFilter = v ?? '';
                _page = 1;
              });
              _load();
            },
          ),
          const SizedBox(height: 14),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_items.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: Text('No audit records found')),
            )
          else
            ..._items.map((l) {
              final date = l['createdAt'] != null
                  ? DateFormat.yMMMd().add_jm().format(
                        DateTime.tryParse(l['createdAt'].toString())?.toLocal() ??
                            DateTime.now(),
                      )
                  : '';
              final name = l['userName']?.toString() ?? popName(l['user']);
              final email = l['userEmail']?.toString() ?? '';
              final role = l['role']?.toString() ?? '';
              final details = l['details']?.toString() ?? '';
              final ip = l['ipAddress']?.toString() ?? '—';

              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: dark ? AppColors.darkCard : Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radius),
                    side: BorderSide(
                      color: dark ? AppColors.slate700 : AppColors.border,
                    ),
                  ),
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
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Icon(
                                Icons.person_outline,
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
                                    name,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 14,
                                    ),
                                  ),
                                  Text(
                                    email,
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
                            if (role.isNotEmpty) StatusChip(role),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          l['action']?.toString() ?? '',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                        if (details.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            details,
                            style: TextStyle(
                              fontSize: 12,
                              color: dark
                                  ? Colors.white70
                                  : AppColors.textSecondary,
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          '$date · IP $ip',
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
                ),
              );
            }),
          if (_totalPages > 1) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton(
                  onPressed: _page <= 1 || _loading
                      ? null
                      : () {
                          setState(() => _page -= 1);
                          _load();
                        },
                  child: const Text('Previous'),
                ),
                Text(
                  'Page $_page / $_totalPages',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                TextButton(
                  onPressed: _page >= _totalPages || _loading
                      ? null
                      : () {
                          setState(() => _page += 1);
                          _load();
                        },
                  child: const Text('Next'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
