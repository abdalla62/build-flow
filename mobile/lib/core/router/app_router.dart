import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:construction_material_mobile_app/core/router/role_nav.dart';
import 'package:construction_material_mobile_app/features/audit/audit_screen.dart';
import 'package:construction_material_mobile_app/features/auth/forgot_password_screen.dart';
import 'package:construction_material_mobile_app/features/auth/login_screen.dart';
import 'package:construction_material_mobile_app/features/auth/reset_password_screen.dart';
import 'package:construction_material_mobile_app/features/auth/splash_screen.dart';
import 'package:construction_material_mobile_app/features/categories/categories_screen.dart';
import 'package:construction_material_mobile_app/features/common/unauthorized_screen.dart';
import 'package:construction_material_mobile_app/features/dashboard/dashboard_screen.dart';
import 'package:construction_material_mobile_app/features/deliveries/deliveries_screen.dart';
import 'package:construction_material_mobile_app/features/inventory/inventory_screen.dart';
import 'package:construction_material_mobile_app/features/inventory/site_stock_screen.dart';
import 'package:construction_material_mobile_app/features/materials/materials_screen.dart';
import 'package:construction_material_mobile_app/features/notifications/notifications_screen.dart';
import 'package:construction_material_mobile_app/features/orders/orders_screen.dart';
import 'package:construction_material_mobile_app/features/payments/payments_screen.dart';
import 'package:construction_material_mobile_app/features/profile/profile_screen.dart';
import 'package:construction_material_mobile_app/features/projects/projects_screen.dart';
import 'package:construction_material_mobile_app/features/quotations/quotations_screen.dart';
import 'package:construction_material_mobile_app/features/reports/reports_screen.dart';
import 'package:construction_material_mobile_app/features/requests/requests_screen.dart';
import 'package:construction_material_mobile_app/features/shell/app_shell.dart';
import 'package:construction_material_mobile_app/features/suppliers/suppliers_screen.dart';
import 'package:construction_material_mobile_app/features/users/users_screen.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';

final routerProvider = Provider<GoRouter>((ref) {
  // Use read + refreshListenable so auth updates do not recreate the router.
  final auth = ref.read(authNotifierProvider);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: auth,
    redirect: (context, state) {
      final status = auth.state.status;
      final path = state.uri.path;
      final isAuthRoute = path == '/login' ||
          path == '/forgot-password' ||
          path.startsWith('/reset-password');
      final isSplash = path == '/splash';

      if (status == AuthStatus.unknown) {
        return isSplash ? null : '/splash';
      }

      if (status == AuthStatus.unauthenticated) {
        if (isSplash) return '/login';
        if (isAuthRoute) return null;
        return '/login';
      }

      // authenticated
      if (isSplash || isAuthRoute) {
        return roleHomePath(auth.state.user?.role);
      }

      if (path != '/unauthorized' && auth.state.user != null) {
        if (!isPathAllowedForRole(path, auth.state.user!.role)) {
          return '/unauthorized';
        }
      }

      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/forgot-password', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(
        path: '/reset-password/:token',
        builder: (_, state) => ResetPasswordScreen(
          token: state.pathParameters['token'] ?? '',
        ),
      ),
      ShellRoute(
        builder: (context, state, child) {
          return AppShell(title: titleForPath(state.uri.path), child: child);
        },
        routes: [
          GoRoute(path: '/', builder: (_, __) => const DashboardScreen()),
          GoRoute(path: '/users', builder: (_, __) => const UsersScreen()),
          GoRoute(path: '/projects', builder: (_, __) => const ProjectsScreen()),
          GoRoute(path: '/categories', builder: (_, __) => const CategoriesScreen()),
          GoRoute(path: '/suppliers', builder: (_, __) => const SuppliersScreen()),
          GoRoute(path: '/materials', builder: (_, __) => const MaterialsScreen()),
          GoRoute(path: '/material-requests', builder: (_, __) => const RequestsScreen()),
          GoRoute(path: '/quotations', builder: (_, __) => const QuotationsScreen()),
          GoRoute(path: '/purchase-orders', builder: (_, __) => const OrdersScreen()),
          GoRoute(path: '/payments', builder: (_, __) => const PaymentsScreen()),
          GoRoute(path: '/deliveries', builder: (_, __) => const DeliveriesScreen()),
          GoRoute(path: '/inventory', builder: (_, __) => const InventoryScreen()),
          GoRoute(path: '/site-stock', builder: (_, __) => const SiteStockScreen()),
          GoRoute(path: '/reports', builder: (_, __) => const ReportsScreen()),
          GoRoute(path: '/audit-logs', builder: (_, __) => const AuditScreen()),
          GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          GoRoute(path: '/unauthorized', builder: (_, __) => const UnauthorizedScreen()),
        ],
      ),
    ],
  );
});
