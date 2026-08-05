import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';

class UnauthorizedScreen extends StatelessWidget {
  const UnauthorizedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_outline, size: 64, color: AppColors.danger),
            const SizedBox(height: 16),
            Text(
              'Unauthorized',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            const Text(
              'You do not have permission to access this page.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 24),
            ElevatedButton(onPressed: () => context.go('/'), child: const Text('Go to Dashboard')),
          ],
        ),
      ),
    );
  }
}
