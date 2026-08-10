import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:construction_material_mobile_app/core/router/role_nav.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/core/utils/media_url.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';

class AppShell extends ConsumerWidget {
  final Widget child;
  final String title;

  const AppShell({super.key, required this.child, required this.title});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authNotifierProvider);
    final user = auth.state.user;
    final menu = user != null ? menuForRole(user.role) : <MenuItem>[];
    final bottomItems =
        user != null ? bottomNavForRole(user.role) : <MenuItem>[];
    final location = GoRouterState.of(context).uri.path;
    final initial =
        (user?.name.isNotEmpty == true ? user!.name[0] : 'U').toUpperCase();
    final dark = Theme.of(context).brightness == Brightness.dark;

    final bottomIndex = bottomItems.indexWhere((m) => m.path == location);

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          const _NotificationBellButton(),
          IconButton(
            tooltip: dark ? 'Light Mode' : 'Dark Mode',
            icon: Icon(
              dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
            ),
            onPressed: () => togglePersistedTheme(ref, dark),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 10),
            child: IconButton(
              tooltip: 'Profile',
              icon: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.secondary.withValues(alpha: 0.45),
                    width: 1.5,
                  ),
                ),
                child: UserAvatar(
                  avatarPath: user?.avatar,
                  initial: initial,
                  radius: 15,
                  backgroundColor: AppColors.secondary.withValues(alpha: 0.2),
                  initialStyle: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              onPressed: () => context.push('/profile'),
            ),
          ),
        ],
      ),
      drawer: Drawer(
        backgroundColor: AppColors.darkNavy,
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        gradient: const LinearGradient(
                          colors: [AppColors.primary, AppColors.secondary],
                        ),
                      ),
                      child: const Icon(
                        Icons.inventory_2_rounded,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 12),
                    RichText(
                      text: const TextSpan(
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: -0.3,
                        ),
                        children: [
                          TextSpan(text: 'BUILD'),
                          TextSpan(
                            text: ' FLOW',
                            style: TextStyle(color: AppColors.secondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFF1E293B)),
              Expanded(
                child: ListView(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  children: menu.map((item) {
                    final active = location == item.path;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Material(
                        color: active
                            ? AppColors.primary
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                        child: ListTile(
                          dense: true,
                          leading: Icon(
                            item.icon,
                            size: 22,
                            color: active
                                ? Colors.white
                                : const Color(0xFF94A3B8),
                          ),
                          title: Text(
                            item.label,
                            style: TextStyle(
                              color: active
                                  ? Colors.white
                                  : const Color(0xFF94A3B8),
                              fontWeight:
                                  active ? FontWeight.w700 : FontWeight.w500,
                              fontSize: 13.5,
                            ),
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          onTap: () {
                            Navigator.pop(context);
                            if (location != item.path) context.go(item.path);
                          },
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              if (user != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFF334155)),
                        ),
                        child: Row(
                          children: [
                            UserAvatar(
                              avatarPath: user?.avatar,
                              initial: initial,
                              radius: 20,
                              backgroundColor:
                                  AppColors.primary.withValues(alpha: 0.35),
                              initialStyle: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    user.name,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    user.role,
                                    style: const TextStyle(
                                      color: Color(0xFF94A3B8),
                                      fontSize: 12,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 6),
                      ListTile(
                        leading: const Icon(
                          Icons.logout_rounded,
                          color: AppColors.danger,
                        ),
                        title: const Text(
                          'Logout',
                          style: TextStyle(
                            color: AppColors.danger,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        onTap: () async {
                          Navigator.pop(context);
                          await ref.read(authNotifierProvider).logout();
                          if (context.mounted) context.go('/login');
                        },
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
      body: child,
      bottomNavigationBar: bottomItems.isEmpty
          ? null
          : Container(
              decoration: BoxDecoration(
                color: dark ? AppColors.darkCard : Colors.white,
                border: Border(
                  top: BorderSide(
                    color: dark ? AppColors.slate700 : AppColors.border,
                  ),
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.darkNavy.withValues(alpha: 0.06),
                    blurRadius: 12,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: NavigationBar(
                  height: 64,
                  backgroundColor: Colors.transparent,
                  elevation: 0,
                  indicatorColor: AppColors.primary.withValues(alpha: 0.14),
                  selectedIndex: bottomIndex < 0 ? 0 : bottomIndex,
                  labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
                  onDestinationSelected: (i) {
                    final path = bottomItems[i].path;
                    if (location != path) context.go(path);
                  },
                  destinations: bottomItems
                      .map(
                        (item) => NavigationDestination(
                          icon: Icon(item.icon),
                          selectedIcon: Icon(
                            _filledNavIcon(item.icon),
                            color: dark
                                ? AppColors.secondary
                                : AppColors.primary,
                          ),
                          label: item.label,
                        ),
                      )
                      .toList(),
                ),
              ),
            ),
    );
  }
}

/// In-app notification bell with unread badge (polls every 30s — same idea as web).
class _NotificationBellButton extends ConsumerStatefulWidget {
  const _NotificationBellButton();

  @override
  ConsumerState<_NotificationBellButton> createState() =>
      _NotificationBellButtonState();
}

class _NotificationBellButtonState
    extends ConsumerState<_NotificationBellButton> {
  Timer? _timer;
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    final auth = ref.read(authNotifierProvider).state;
    if (auth.user == null) {
      if (mounted) setState(() => _unread = 0);
      return;
    }
    try {
      final items = await ref.read(apiRepositoryProvider).getNotifications();
      final count = items.where((n) => n['read'] != true).length;
      if (mounted) setState(() => _unread = count);
    } catch (_) {
      // Silent — bell stays at last known count
    }
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Notifications',
      onPressed: () async {
        await context.push('/notifications');
        _refresh();
      },
      icon: Badge(
        isLabelVisible: _unread > 0,
        label: Text(
          _unread > 99 ? '99+' : '$_unread',
          style: const TextStyle(fontSize: 10),
        ),
        child: const Icon(Icons.notifications_outlined),
      ),
    );
  }
}

IconData _filledNavIcon(IconData outlined) {
  if (outlined == Icons.home_outlined) return Icons.home_rounded;
  if (outlined == Icons.assignment_outlined) return Icons.assignment;
  if (outlined == Icons.receipt_long_outlined) return Icons.receipt_long;
  if (outlined == Icons.account_balance_wallet_outlined) {
    return Icons.account_balance_wallet;
  }
  if (outlined == Icons.person_outline) return Icons.person;
  if (outlined == Icons.local_shipping_outlined) return Icons.local_shipping;
  if (outlined == Icons.request_quote_outlined) return Icons.request_quote;
  if (outlined == Icons.apartment_outlined) return Icons.apartment;
  if (outlined == Icons.fact_check_outlined) return Icons.fact_check;
  if (outlined == Icons.route_outlined) return Icons.route;
  return outlined;
}
