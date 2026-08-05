import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:construction_material_mobile_app/core/network/api_client.dart';
import 'package:construction_material_mobile_app/core/router/app_router.dart';
import 'package:construction_material_mobile_app/core/theme/app_scroll_behavior.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final apiClient = ApiClient();
  await apiClient.init();

  final container = ProviderContainer(
    overrides: [
      apiClientProvider.overrideWithValue(apiClient),
    ],
  );
  await loadPersistedTheme(container);

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const BuildFlowApp(),
    ),
  );
}

class BuildFlowApp extends ConsumerStatefulWidget {
  const BuildFlowApp({super.key});

  @override
  ConsumerState<BuildFlowApp> createState() => _BuildFlowAppState();
}

class _BuildFlowAppState extends ConsumerState<BuildFlowApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authNotifierProvider).bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'BUILD FLOW',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: themeMode,
      scrollBehavior: const AppScrollBehavior(),
      routerConfig: router,
    );
  }
}
