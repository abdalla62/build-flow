import 'dart:ui';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:construction_material_mobile_app/core/theme/app_scroll_behavior.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';
import 'package:construction_material_mobile_app/shared/widgets/ui.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen>
    with TickerProviderStateMixin {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  late final AnimationController _kenBurns;
  late final AnimationController _enter;

  @override
  void initState() {
    super.initState();
    _kenBurns = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 22),
    )..repeat(reverse: true);
    _enter = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _load();
  }

  @override
  void dispose() {
    _kenBurns.dispose();
    _enter.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final role = ref.read(authNotifierProvider).state.user?.role;
      final api = ref.read(apiRepositoryProvider);
      final Map<String, dynamic> data = switch (role) {
        'Administrator' => await api.getAdminDashboard(),
        'Site Engineer' => await api.getSiteEngineerDashboard(),
        'Project Manager' => await api.getProjectManagerDashboard(),
        'Procurement Officer' => await api.getProcurementDashboard(),
        'Delivery Staff' => await api.getDeliveryStaffDashboard(),
        'Accountant' || 'Supplier' => {
            'summary': await api.getPaymentSummary(),
          },
        _ => <String, dynamic>{},
      };
      if (mounted) {
        setState(() => _data = data);
        _enter.forward(from: 0);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _n(dynamic v) => '${v ?? 0}';

  String _money(dynamic v) {
    final n = (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;
    return NumberFormat.currency(symbol: '\$', decimalDigits: 0).format(n);
  }

  /// Field keys match web Dashboard.jsx + /api/dashboard/* responses.
  List<_StatCard> _statsForRole(String? role) {
    final stats = _data?['stats'] as Map<String, dynamic>? ?? {};
    final summary = _data?['summary'] as Map<String, dynamic>? ?? {};
    final loaded = _data != null;

    String count(dynamic key) => loaded ? _n(stats[key]) : '—';
    String money(dynamic key) => loaded ? _money(stats[key]) : '—';
    String sumCount(String key) => loaded ? _n(summary[key]) : '—';
    String sumMoney(String key) => loaded ? _money(summary[key]) : '—';

    switch (role) {
      case 'Administrator':
        return [
          _StatCard('Total Users', count('totalUsers'), Icons.people_alt_rounded, AppColors.users, AppColors.usersBg),
          _StatCard('Total Projects', count('totalProjects'), Icons.apartment_rounded, AppColors.projects, AppColors.projectsBg),
          _StatCard('Total Materials', count('totalMaterials'), Icons.inventory_2_rounded, AppColors.materials, AppColors.materialsBg),
          _StatCard('Total Suppliers', count('totalSuppliers'), Icons.local_shipping_rounded, AppColors.suppliers, AppColors.suppliersBg),
          _StatCard('Total Purchase Orders', count('totalPurchaseOrders'), Icons.description_rounded, AppColors.orders, AppColors.ordersBg),
          _StatCard('Total Deliveries', count('totalDeliveries'), Icons.check_circle_rounded, AppColors.deliveries, AppColors.deliveriesBg),
          _StatCard('Total Payments', count('totalPayments'), Icons.payments_rounded, AppColors.payments, AppColors.paymentsBg),
        ];
      case 'Site Engineer':
        return [
          _StatCard('My Requests', count('myRequests'), Icons.assignment_rounded, AppColors.users, AppColors.usersBg),
          _StatCard('Pending Requests', count('pendingRequests'), Icons.hourglass_top_rounded, AppColors.suppliers, AppColors.suppliersBg),
          _StatCard('Approved Requests', count('approvedRequests'), Icons.check_circle_rounded, AppColors.projects, AppColors.projectsBg),
          _StatCard('Delivered Materials', count('deliveredMaterials'), Icons.local_shipping_rounded, AppColors.deliveries, AppColors.deliveriesBg),
        ];
      case 'Project Manager':
        return [
          _StatCard('Pending Requests', count('pendingRequests'), Icons.hourglass_top_rounded, AppColors.suppliers, AppColors.suppliersBg),
          _StatCard('Approved Requests', count('approvedRequests'), Icons.check_circle_rounded, AppColors.projects, AppColors.projectsBg),
          _StatCard('Rejected Requests', count('rejectedRequests'), Icons.cancel_rounded, AppColors.payments, AppColors.paymentsBg),
          _StatCard('Budget Requests', money('budgetRequests'), Icons.payments_rounded, AppColors.deliveries, AppColors.deliveriesBg),
        ];
      case 'Procurement Officer':
        return [
          _StatCard('Approved Requests', count('approvedRequests'), Icons.check_circle_rounded, AppColors.projects, AppColors.projectsBg),
          _StatCard('Active Quotations', count('activeQuotations'), Icons.description_rounded, AppColors.users, AppColors.usersBg),
          _StatCard('Draft POs', count('draftPOs'), Icons.schedule_rounded, AppColors.suppliers, AppColors.suppliersBg),
          _StatCard('Deliveries Scheduled', count('deliveriesScheduled'), Icons.local_shipping_rounded, AppColors.materials, AppColors.materialsBg),
        ];
      case 'Supplier':
        return [
          _StatCard('Open Unpaid POs', sumCount('unpaidCount'), Icons.description_rounded, AppColors.projects, AppColors.projectsBg),
          _StatCard('Payment Outstanding', sumMoney('outstandingTotal'), Icons.payments_rounded, AppColors.materials, AppColors.materialsBg),
          _StatCard('Paid This Month', sumMoney('paidThisMonth'), Icons.check_circle_rounded, AppColors.deliveries, AppColors.deliveriesBg),
          _StatCard('Overdue', sumCount('overdueCount'), Icons.warning_amber_rounded, AppColors.payments, AppColors.paymentsBg),
        ];
      case 'Accountant':
        return [
          _StatCard(
            'Unpaid Invoices',
            loaded ? '${sumCount('unpaidCount')} items' : '—',
            Icons.schedule_rounded,
            AppColors.payments,
            AppColors.paymentsBg,
          ),
          _StatCard('Total Outstanding', sumMoney('outstandingTotal'), Icons.payments_rounded, AppColors.suppliers, AppColors.suppliersBg),
          _StatCard('Total Paid (Month)', sumMoney('paidThisMonth'), Icons.check_circle_rounded, AppColors.deliveries, AppColors.deliveriesBg),
          _StatCard(
            'Overdue Payments',
            loaded ? '${sumCount('overdueCount')} invoices' : '—',
            Icons.warning_amber_rounded,
            AppColors.payments,
            AppColors.paymentsBg,
          ),
        ];
      case 'Delivery Staff':
        final assigned = loaded ? _n(stats['assignedShipments']) : '—';
        final completed = loaded ? _n(stats['completedDeliveries']) : '—';
        final delayed = loaded ? _n(stats['delayedShipments']) : '—';
        final route = loaded
            ? (stats['activeRoute']?.toString() ?? 'No active route')
            : '—';
        return [
          _StatCard(
            'Assigned Shipments',
            loaded ? '$assigned Pending' : '—',
            Icons.local_shipping_rounded,
            AppColors.users,
            AppColors.usersBg,
          ),
          _StatCard(
            'Completed Deliveries',
            loaded ? '$completed successfully' : '—',
            Icons.check_circle_rounded,
            AppColors.deliveries,
            AppColors.deliveriesBg,
          ),
          _StatCard(
            'Delayed Shipments',
            loaded ? '$delayed alert${delayed == '1' ? '' : 's'}' : '—',
            Icons.warning_amber_rounded,
            AppColors.suppliers,
            AppColors.suppliersBg,
          ),
          _StatCard(
            'Active Route',
            route,
            Icons.route_rounded,
            AppColors.projects,
            AppColors.projectsBg,
          ),
        ];
      default:
        return [
          _StatCard('Welcome', '—', Icons.dashboard_rounded, AppColors.projects, AppColors.projectsBg),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authNotifierProvider).state.user?.role ?? '';
    final dark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = dark ? AppColors.darkNavy : AppColors.lightBg;

    if (_loading) {
      return ColoredBox(
        color: scaffoldBg,
        child: const LoadingView(message: 'Loading dashboard…'),
      );
    }
    if (_error != null) {
      return ColoredBox(
        color: scaffoldBg,
        child: ErrorView(message: _error!, onRetry: _load),
      );
    }

    final stats = _statsForRole(role);
    final localTime = DateFormat.yMd().format(DateTime.now());

    // Match web Dashboard.jsx: light soft wash / dark cinematic.
    final topOverlay = dark
        ? const [
            Color(0xCC020617), // slate-950/80
            Color(0x730F766E), // teal-ish
            Color(0x8C0F172A),
          ]
        : const [
            Color(0xCCF1F5F9), // slate-100 soft
            Color(0x8CE2E8F0),
            Color(0x73CCFBF1), // teal tint
          ];
    final bottomOverlay = dark
        ? const [
            Color(0x00020617),
            Color(0x4D0F172A),
            Color(0xE60F172A),
          ]
        : const [
            Color(0x00F1F5F9),
            Color(0x66F1F5F9),
            Color(0xE6F1F5F9),
          ];

    return Stack(
      fit: StackFit.expand,
      children: [
        AnimatedBuilder(
          animation: _kenBurns,
          builder: (context, child) {
            final t = Curves.easeInOut.transform(_kenBurns.value);
            return Transform.scale(
              scale: 1.05 + t * 0.07,
              child: child,
            );
          },
          child: Image.asset(
            role == 'Administrator'
                ? 'assets/images/admin-dashboard-bg.png'
                : role == 'Project Manager'
                    ? 'assets/images/pm-dashboard-bg.png'
                    : role == 'Accountant'
                        ? 'assets/images/accountant-dashboard-bg.png'
                        : role == 'Supplier'
                            ? 'assets/images/supplier-dashboard-bg.png'
                            : role == 'Procurement Officer'
                                ? 'assets/images/procurement-dashboard-bg.png'
                                : role == 'Delivery Staff'
                                    ? 'assets/images/delivery-dashboard-bg.png'
                                    : role == 'Site Engineer'
                                        ? 'assets/images/site-engineer-dashboard-bg.png'
                                        : 'assets/images/dashboard-bg.png',
            fit: BoxFit.cover,
            alignment: Alignment.center,
            errorBuilder: (_, _, _) => Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: dark
                      ? const [AppColors.darkNavy, AppColors.darkCard]
                      : const [AppColors.darkNavy, AppColors.primary, AppColors.darkCard],
                ),
              ),
            ),
          ),
        ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 280),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: topOverlay,
            ),
          ),
        ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 280),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: bottomOverlay,
              stops: const [0.0, 0.42, 1.0],
            ),
          ),
        ),
        Positioned(
          top: -40,
          right: -30,
          child: _GlowOrb(
            color: AppColors.secondary.withValues(alpha: dark ? 0.12 : 0.28),
            size: 180,
          ),
        ),
        Positioned(
          bottom: 80,
          left: -20,
          child: _GlowOrb(
            color: AppColors.accent.withValues(alpha: dark ? 0.1 : 0.18),
            size: 140,
          ),
        ),
        RefreshIndicator(
          color: AppColors.primary,
          onRefresh: _load,
          child: ListView(
            physics: kAppScrollPhysics,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              FadeTransition(
                opacity: CurvedAnimation(
                  parent: _enter,
                  curve: const Interval(0, 0.4, curve: Curves.easeOut),
                ),
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.1),
                    end: Offset.zero,
                  ).animate(
                    CurvedAnimation(
                      parent: _enter,
                      curve: const Interval(0, 0.45, curve: Curves.easeOutCubic),
                    ),
                  ),
                  child: _WebStyleHeader(
                    role: role,
                    localTime: localTime,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: stats.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.28,
                ),
                itemBuilder: (context, index) {
                  final start = (0.15 + index * 0.07).clamp(0.0, 0.85);
                  final end = (start + 0.35).clamp(0.0, 1.0);
                  return FadeTransition(
                    opacity: CurvedAnimation(
                      parent: _enter,
                      curve: Interval(start, end, curve: Curves.easeOut),
                    ),
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0, 0.16),
                        end: Offset.zero,
                      ).animate(
                        CurvedAnimation(
                          parent: _enter,
                          curve: Interval(start, end, curve: Curves.easeOutCubic),
                        ),
                      ),
                      child: _StatTile(card: stats[index]),
                    ),
                  );
                },
              ),
              if (role == 'Administrator') ...[
                const SizedBox(height: 16),
                _AdminSpendTrendCard(
                  trends: (_data?['spendTrends'] as List?)
                          ?.whereType<Map>()
                          .map((e) => Map<String, dynamic>.from(e))
                          .toList() ??
                      const [],
                ),
                const SizedBox(height: 12),
                _AdminCategorySpendCard(
                  categories: (_data?['categoryData'] as List?)
                          ?.whereType<Map>()
                          .map((e) => Map<String, dynamic>.from(e))
                          .toList() ??
                      const [],
                  totalSpend: (_data?['totalCategorySpend'] as num?)?.toDouble() ??
                      0,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Matches web: "Dashboard" + role subtitle + Local Time pill.
class _WebStyleHeader extends StatelessWidget {
  final String role;
  final String localTime;

  const _WebStyleHeader({
    required this.role,
    required this.localTime,
  });

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = dark ? Colors.white : AppColors.textPrimary;
    final bodyColor = dark ? const Color(0xFFCBD5E1) : AppColors.textSecondary;
    final roleColor = dark ? const Color(0xFF5EEAD4) : AppColors.primary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Dashboard',
          style: TextStyle(
            color: titleColor,
            fontSize: 30,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
            height: 1.1,
            shadows: dark
                ? const [
                    Shadow(color: Color(0x66000000), blurRadius: 12, offset: Offset(0, 2)),
                  ]
                : null,
          ),
        ),
        const SizedBox(height: 6),
        Text.rich(
          TextSpan(
            style: TextStyle(
              color: bodyColor,
              fontSize: 13.5,
              height: 1.35,
            ),
            children: [
              const TextSpan(
                text: 'Overview of procurement metrics and activities for ',
              ),
              TextSpan(
                text: role.isEmpty ? 'your role' : role,
                style: TextStyle(
                  color: roleColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const TextSpan(text: '.'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: dark
                ? AppColors.darkCard.withValues(alpha: 0.85)
                : AppColors.card.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: dark
                  ? AppColors.primary.withValues(alpha: 0.3)
                  : AppColors.border,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.darkNavy.withValues(alpha: 0.06),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.access_time_rounded, size: 14, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                'Local Time: $localTime',
                style: TextStyle(
                  color: dark ? Colors.white : AppColors.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _GlowOrb extends StatelessWidget {
  final Color color;
  final double size;

  const _GlowOrb({required this.color, required this.size});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 48, sigmaY: 48),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
          ),
        ),
      ),
    );
  }
}

class _StatCard {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final Color iconBg;

  _StatCard(this.label, this.value, this.icon, this.color, [Color? iconBg])
      : iconBg = iconBg ?? color.withValues(alpha: 0.12);
}

/// Press feedback matching web whileHover (lift) + whileTap (scale) + icon wiggle.
class _StatTile extends StatefulWidget {
  final _StatCard card;

  const _StatTile({required this.card});

  @override
  State<_StatTile> createState() => _StatTileState();
}

class _StatTileState extends State<_StatTile>
    with TickerProviderStateMixin {
  late final AnimationController _press;
  late final AnimationController _iconWiggle;
  late final Animation<double> _scale;
  late final Animation<double> _lift;
  late final Animation<double> _shadow;
  late final Animation<double> _iconTurn;
  late final Animation<double> _iconScale;

  @override
  void initState() {
    super.initState();
    _press = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 160),
      reverseDuration: const Duration(milliseconds: 280),
    );
    _iconWiggle = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 450),
    );
    _scale = Tween<double>(begin: 1.0, end: 1.02).animate(
      CurvedAnimation(parent: _press, curve: Curves.easeOutCubic),
    );
    _lift = Tween<double>(begin: 0, end: -6).animate(
      CurvedAnimation(parent: _press, curve: Curves.easeOutCubic),
    );
    _shadow = Tween<double>(begin: 0.08, end: 0.18).animate(
      CurvedAnimation(parent: _press, curve: Curves.easeOut),
    );
    _iconTurn = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: -0.08), weight: 25),
      TweenSequenceItem(tween: Tween(begin: -0.08, end: 0.08), weight: 40),
      TweenSequenceItem(tween: Tween(begin: 0.08, end: 0), weight: 35),
    ]).animate(CurvedAnimation(parent: _iconWiggle, curve: Curves.easeInOut));
    _iconScale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.12), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.12, end: 1.0), weight: 50),
    ]).animate(CurvedAnimation(parent: _iconWiggle, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _press.dispose();
    _iconWiggle.dispose();
    super.dispose();
  }

  void _onDown(TapDownDetails _) {
    _press.forward();
    _iconWiggle.forward(from: 0);
  }

  void _onUp([_]) {
    _press.reverse();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final card = widget.card;
    final cardBg = dark ? AppColors.darkCard : AppColors.card;
    final cardBorder = dark ? AppColors.darkBorder : AppColors.border;
    final labelColor = dark ? AppColors.darkMuted : AppColors.textSecondary;
    final valueColor = dark ? Colors.white : AppColors.textPrimary;
    final iconBg = dark ? card.color.withValues(alpha: 0.22) : card.iconBg;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: _onDown,
      onTapUp: _onUp,
      onTapCancel: _onUp,
      child: AnimatedBuilder(
        animation: Listenable.merge([_press, _iconWiggle]),
        builder: (context, child) {
          return Transform.translate(
            offset: Offset(0, _lift.value),
            child: Transform.scale(
              scale: _scale.value,
              child: child,
            ),
          );
        },
        child: AnimatedBuilder(
              animation: _press,
              builder: (context, child) {
                final shadowAlpha = dark
                    ? 0.28 + _shadow.value * 0.2
                    : 0.06 + _shadow.value * 0.08;
                return Container(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: cardBg,
                    border: Border.all(color: cardBorder),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.darkNavy.withValues(alpha: shadowAlpha),
                        blurRadius: 16 + _press.value * 10,
                        offset: Offset(0, 6 + _press.value * 3),
                      ),
                    ],
                  ),
                  child: child,
                );
              },
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          card.label.toUpperCase(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.55,
                            color: labelColor,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      AnimatedBuilder(
                        animation: _iconWiggle,
                        builder: (context, child) {
                          return Transform.rotate(
                            angle: _iconTurn.value * 3.14159,
                            child: Transform.scale(
                              scale: _iconScale.value,
                              child: child,
                            ),
                          );
                        },
                        child: Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: iconBg,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(card.icon, color: card.color, size: 19),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Text(
                    card.value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: valueColor,
                      height: 1.1,
                      letterSpacing: -0.5,
                    ),
                  ),
                ],
              ),
        ),
      ),
    );
  }
}

Color _parseHexColor(String? hex, [Color fallback = AppColors.primary]) {
  if (hex == null || hex.isEmpty) return fallback;
  var s = hex.replaceFirst('#', '');
  if (s.length == 6) s = 'FF$s';
  final v = int.tryParse(s, radix: 16);
  return v == null ? fallback : Color(v);
}

class _GlassPanel extends StatefulWidget {
  final Widget child;

  const _GlassPanel({required this.child});

  @override
  State<_GlassPanel> createState() => _GlassPanelState();
}

class _GlassPanelState extends State<_GlassPanel>
    with SingleTickerProviderStateMixin {
  late final AnimationController _press;
  late final Animation<double> _lift;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _press = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 160),
      reverseDuration: const Duration(milliseconds: 280),
    );
    // Match web chart cards: whileHover={{ y: -4 }}
    _lift = Tween<double>(begin: 0, end: -4).animate(
      CurvedAnimation(parent: _press, curve: Curves.easeOutCubic),
    );
    _scale = Tween<double>(begin: 1.0, end: 1.01).animate(
      CurvedAnimation(parent: _press, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _press.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = dark ? AppColors.darkCard : AppColors.card;
    final cardBorder = dark ? AppColors.darkBorder : AppColors.border;

    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _press.forward(),
      onPointerUp: (_) => _press.reverse(),
      onPointerCancel: (_) => _press.reverse(),
      child: AnimatedBuilder(
        animation: _press,
        builder: (context, child) {
          return Transform.translate(
            offset: Offset(0, _lift.value),
            child: Transform.scale(
              scale: _scale.value,
              child: child,
            ),
          );
        },
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: cardBg,
            border: Border.all(color: cardBorder),
            boxShadow: [
              BoxShadow(
                color: AppColors.darkNavy.withValues(
                  alpha: dark ? 0.28 : 0.08,
                ),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: widget.child,
        ),
      ),
    );
  }
}

/// Matches web: Procurement expenditure area chart from spendTrends.
class _AdminSpendTrendCard extends StatelessWidget {
  final List<Map<String, dynamic>> trends;

  const _AdminSpendTrendCard({required this.trends});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = dark ? Colors.white : AppColors.darkNavy;
    final subColor = dark ? const Color(0xFF94A3B8) : AppColors.textSecondary;

    return _GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Procurement expenditure',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: titleColor,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'Real monthly PO totals from the system',
            style: TextStyle(fontSize: 11.5, color: subColor),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 200,
            child: trends.isEmpty
                ? Center(
                    child: Text(
                      'No purchase order spend data yet',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: subColor,
                      ),
                    ),
                  )
                : LineChart(
                    LineChartData(
                      minY: 0,
                      gridData: FlGridData(
                        show: true,
                        drawVerticalLine: false,
                        getDrawingHorizontalLine: (v) => FlLine(
                          color: dark
                              ? AppColors.slate700
                              : const Color(0xFFE2E8F0),
                          strokeWidth: 1,
                          dashArray: [4, 4],
                        ),
                      ),
                      borderData: FlBorderData(show: false),
                      titlesData: FlTitlesData(
                        topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 36,
                            getTitlesWidget: (v, _) => Text(
                              v.toInt().toString(),
                              style: TextStyle(fontSize: 10, color: subColor),
                            ),
                          ),
                        ),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 28,
                            interval: 1,
                            getTitlesWidget: (v, meta) {
                              final i = v.toInt();
                              if (i < 0 || i >= trends.length) {
                                return const SizedBox.shrink();
                              }
                              return Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(
                                  trends[i]['month']?.toString() ?? '',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: subColor,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                      lineTouchData: LineTouchData(
                        touchTooltipData: LineTouchTooltipData(
                          getTooltipColor: (_) => const Color(0xFF1E293B),
                          getTooltipItems: (spots) => spots
                              .map(
                                (s) => LineTooltipItem(
                                  '\$${NumberFormat('#,###').format(s.y)}',
                                  const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12,
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ),
                      lineBarsData: [
                        LineChartBarData(
                          spots: [
                            for (var i = 0; i < trends.length; i++)
                              FlSpot(
                                i.toDouble(),
                                (trends[i]['expenditure'] as num?)
                                        ?.toDouble() ??
                                    0,
                              ),
                          ],
                          isCurved: true,
                          color: AppColors.primary,
                          barWidth: 2.5,
                          isStrokeCapRound: true,
                          dotData: const FlDotData(show: true),
                          belowBarData: BarAreaData(
                            show: true,
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                AppColors.primary.withValues(alpha: 0.22),
                                AppColors.primary.withValues(alpha: 0.0),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

/// Matches web: Spend by Category donut + legend from categoryData.
class _AdminCategorySpendCard extends StatelessWidget {
  final List<Map<String, dynamic>> categories;
  final double totalSpend;

  const _AdminCategorySpendCard({
    required this.categories,
    required this.totalSpend,
  });

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = dark ? Colors.white : AppColors.darkNavy;
    final subColor = dark ? const Color(0xFF94A3B8) : AppColors.textSecondary;
    final money = NumberFormat.currency(symbol: '\$', decimalDigits: 0);

    return _GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Spend by Category',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: titleColor,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'PO line totals grouped by stock category',
            style: TextStyle(fontSize: 11.5, color: subColor),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 180,
            child: categories.isEmpty
                ? Center(
                    child: Text(
                      'No category spend yet',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: subColor,
                      ),
                    ),
                  )
                : Stack(
                    alignment: Alignment.center,
                    children: [
                      PieChart(
                        PieChartData(
                          sectionsSpace: 3,
                          centerSpaceRadius: 48,
                          sections: [
                            for (final c in categories)
                              PieChartSectionData(
                                value: (c['value'] as num?)?.toDouble() ?? 0,
                                color: _parseHexColor(c['color']?.toString()),
                                radius: 28,
                                showTitle: false,
                              ),
                          ],
                        ),
                      ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            money.format(totalSpend),
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: titleColor,
                            ),
                          ),
                          Text(
                            'TOTAL SPENT',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.6,
                              color: subColor,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
          ),
          if (categories.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...categories.map((c) {
              final color = _parseHexColor(c['color']?.toString());
              final value = (c['value'] as num?)?.toDouble() ?? 0;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        c['name']?.toString() ?? '—',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: subColor,
                        ),
                      ),
                    ),
                    Text(
                      money.format(value),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: titleColor,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}
