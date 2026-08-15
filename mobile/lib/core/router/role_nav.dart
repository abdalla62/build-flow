import 'package:flutter/material.dart';

class MenuItem {
  final String path;
  final String label;
  final IconData icon;

  const MenuItem({required this.path, required this.label, required this.icon});
}

/// Sidebar menu matching web `Sidebar.jsx`.
List<MenuItem> menuForRole(String role) {
  final links = <MenuItem>[
    const MenuItem(path: '/', label: 'Dashboard', icon: Icons.dashboard_outlined),
  ];

  switch (role) {
    case 'Administrator':
      links.addAll(const [
        MenuItem(path: '/users', label: 'Users', icon: Icons.people_outline),
        MenuItem(path: '/projects', label: 'Projects', icon: Icons.work_outline),
        MenuItem(path: '/materials', label: 'Materials', icon: Icons.inventory_2_outlined),
        MenuItem(path: '/categories', label: 'Categories', icon: Icons.category_outlined),
        MenuItem(path: '/suppliers', label: 'Suppliers', icon: Icons.local_shipping_outlined),
        MenuItem(path: '/material-requests', label: 'Material Requests', icon: Icons.assignment_outlined),
        MenuItem(path: '/quotations', label: 'Supplier Quotes', icon: Icons.layers_outlined),
        MenuItem(path: '/purchase-orders', label: 'Purchase Orders', icon: Icons.description_outlined),
        MenuItem(path: '/deliveries', label: 'Deliveries', icon: Icons.local_shipping_outlined),
        MenuItem(path: '/inventory', label: 'Inventory', icon: Icons.inventory_outlined),
        MenuItem(path: '/payments', label: 'Payments', icon: Icons.payments_outlined),
        MenuItem(path: '/reports', label: 'Reports', icon: Icons.bar_chart_outlined),
        MenuItem(path: '/audit-logs', label: 'Audit Logs', icon: Icons.history),
      ]);
    case 'Site Engineer':
      links.addAll(const [
        MenuItem(path: '/material-requests', label: 'Material Requests', icon: Icons.assignment_outlined),
        MenuItem(path: '/deliveries', label: 'Track Delivery', icon: Icons.local_shipping_outlined),
      ]);
    case 'Project Manager':
      links.addAll(const [
        MenuItem(path: '/projects', label: 'Projects', icon: Icons.work_outline),
        MenuItem(path: '/material-requests', label: 'Review Requests', icon: Icons.check_box_outlined),
      ]);
    case 'Procurement Officer':
      links.addAll(const [
        MenuItem(path: '/material-requests', label: 'Material Requests', icon: Icons.assignment_outlined),
        MenuItem(path: '/quotations', label: 'Supplier Quotes', icon: Icons.layers_outlined),
        MenuItem(path: '/purchase-orders', label: 'Purchase Orders', icon: Icons.description_outlined),
        MenuItem(path: '/deliveries', label: 'Schedule Delivery', icon: Icons.local_shipping_outlined),
        MenuItem(path: '/reports', label: 'Reports', icon: Icons.bar_chart_outlined),
      ]);
    case 'Supplier':
      // Match web Sidebar: PO list + Invoices & POs (same route, invoice actions on screen).
      links.addAll(const [
        MenuItem(path: '/purchase-orders', label: 'Purchase Orders', icon: Icons.description_outlined),
        MenuItem(path: '/quotations', label: 'Quotes & Bids', icon: Icons.layers_outlined),
        MenuItem(path: '/purchase-orders', label: 'Invoices & POs', icon: Icons.payments_outlined),
        MenuItem(path: '/reports', label: 'My Reports', icon: Icons.bar_chart_outlined),
      ]);
    case 'Accountant':
      links.addAll(const [
        MenuItem(path: '/purchase-orders', label: 'Purchase Orders', icon: Icons.description_outlined),
        MenuItem(path: '/payments', label: 'Record Payments', icon: Icons.payments_outlined),
      ]);
    case 'Delivery Staff':
      links.add(const MenuItem(
        path: '/deliveries',
        label: 'My Deliveries',
        icon: Icons.local_shipping_outlined,
      ));
  }

  links.add(const MenuItem(path: '/profile', label: 'Profile Settings', icon: Icons.settings_outlined));
  return links;
}

/// Default landing page after login — matches web `roleHome.js`.
String roleHomePath(String? role) {
  switch (role) {
    case 'Administrator':
      return '/';
    case 'Site Engineer':
    case 'Project Manager':
      return '/material-requests';
    case 'Procurement Officer':
    case 'Supplier':
      return '/purchase-orders';
    case 'Accountant':
      return '/payments';
    case 'Delivery Staff':
      return '/deliveries';
    default:
      return '/';
  }
}

bool isPathAllowedForRole(String path, String role) {
  if (path == '/notifications' || path == '/unauthorized') return true;
  return menuForRole(role).any((m) => m.path == path);
}

/// Primary bottom-nav destinations per role (subset of [menuForRole] paths only).
List<MenuItem> bottomNavForRole(String role) {
  switch (role) {
    case 'Administrator':
      return const [
        MenuItem(path: '/', label: 'Home', icon: Icons.home_outlined),
        MenuItem(path: '/material-requests', label: 'Requests', icon: Icons.assignment_outlined),
        MenuItem(path: '/purchase-orders', label: 'Orders', icon: Icons.receipt_long_outlined),
        MenuItem(path: '/payments', label: 'Pay', icon: Icons.account_balance_wallet_outlined),
      ];
    case 'Site Engineer':
      return const [
        MenuItem(path: '/', label: 'Home', icon: Icons.home_outlined),
        MenuItem(path: '/material-requests', label: 'Requests', icon: Icons.assignment_outlined),
        MenuItem(path: '/deliveries', label: 'Delivery', icon: Icons.local_shipping_outlined),
        MenuItem(path: '/profile', label: 'Profile', icon: Icons.person_outline),
      ];
    case 'Project Manager':
      return const [
        MenuItem(path: '/', label: 'Home', icon: Icons.home_outlined),
        MenuItem(path: '/projects', label: 'Projects', icon: Icons.apartment_outlined),
        MenuItem(path: '/material-requests', label: 'Review', icon: Icons.fact_check_outlined),
        MenuItem(path: '/profile', label: 'Profile', icon: Icons.person_outline),
      ];
    case 'Procurement Officer':
      return const [
        MenuItem(path: '/', label: 'Home', icon: Icons.home_outlined),
        MenuItem(path: '/quotations', label: 'Quotes', icon: Icons.request_quote_outlined),
        MenuItem(path: '/purchase-orders', label: 'Orders', icon: Icons.receipt_long_outlined),
        MenuItem(path: '/deliveries', label: 'Ship', icon: Icons.local_shipping_outlined),
      ];
    case 'Supplier':
      return const [
        MenuItem(path: '/', label: 'Home', icon: Icons.home_outlined),
        MenuItem(path: '/purchase-orders', label: 'Orders', icon: Icons.receipt_long_outlined),
        MenuItem(path: '/quotations', label: 'Bids', icon: Icons.request_quote_outlined),
        MenuItem(path: '/profile', label: 'Profile', icon: Icons.person_outline),
      ];
    case 'Accountant':
      return const [
        MenuItem(path: '/', label: 'Home', icon: Icons.home_outlined),
        MenuItem(path: '/purchase-orders', label: 'Orders', icon: Icons.receipt_long_outlined),
        MenuItem(path: '/payments', label: 'Pay', icon: Icons.account_balance_wallet_outlined),
        MenuItem(path: '/profile', label: 'Profile', icon: Icons.person_outline),
      ];
    case 'Delivery Staff':
      return const [
        MenuItem(path: '/', label: 'Home', icon: Icons.home_outlined),
        MenuItem(path: '/deliveries', label: 'Routes', icon: Icons.route_outlined),
        MenuItem(path: '/profile', label: 'Profile', icon: Icons.person_outline),
      ];
    default:
      return const [
        MenuItem(path: '/', label: 'Home', icon: Icons.home_outlined),
        MenuItem(path: '/profile', label: 'Profile', icon: Icons.person_outline),
      ];
  }
}

String titleForPath(String path) {
  const titles = {
    '/': 'Dashboard',
    '/users': 'Users',
    '/projects': 'Projects',
    '/materials': 'Materials',
    '/categories': 'Categories',
    '/suppliers': 'Suppliers',
    '/material-requests': 'Material Requests',
    '/quotations': 'Supplier Quotes',
    '/purchase-orders': 'Purchase Orders',
    '/deliveries': 'Deliveries',
    '/inventory': 'Inventory',
    '/payments': 'Payments',
    '/reports': 'Reports',
    '/audit-logs': 'Audit Logs',
    '/notifications': 'Notifications',
    '/profile': 'Profile Settings',
    '/unauthorized': 'Unauthorized',
  };
  return titles[path] ?? 'BUILD FLOW';
}
