import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
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
      final items = await ref.read(apiRepositoryProvider).getNotifications();
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAll() async {
    await ref.read(apiRepositoryProvider).markAllNotificationsRead();
    _load();
  }

  Future<void> _markRead(String id) async {
    await ref.read(apiRepositoryProvider).markNotificationRead(id);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    return Column(
      children: [
        if (_items.isNotEmpty)
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(onPressed: _markAll, child: const Text('Mark all read')),
          ),
        Expanded(
          child: _items.isEmpty
              ? const EmptyView(message: 'No notifications')
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    itemCount: _items.length,
                    itemBuilder: (context, i) {
                      final n = _items[i];
                      final read = n['read'] == true;
                      final date = n['createdAt'] != null
                          ? DateFormat.yMMMd().add_jm().format(DateTime.parse(n['createdAt'].toString()))
                          : '';
                      return Card(
                        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        color: read ? null : Theme.of(context).colorScheme.primary.withValues(alpha: 0.05),
                        child: ListTile(
                          title: Text(n['title']?.toString() ?? '', style: TextStyle(fontWeight: read ? FontWeight.normal : FontWeight.w700)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(n['message']?.toString() ?? ''),
                              const SizedBox(height: 4),
                              Text(date, style: const TextStyle(fontSize: 11)),
                            ],
                          ),
                          onTap: () => _markRead((n['_id'] ?? n['id']).toString()),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}
