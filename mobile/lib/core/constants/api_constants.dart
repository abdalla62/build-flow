import 'package:flutter/foundation.dart';

/// API base URL configuration.
///
/// - Debug (Start Debugging / `flutter run`): Android emulator → local server
///   `http://10.0.2.2:5000` (Pixel / any AVD — same alias to your PC).
/// - Release / profile: production Render.
/// - Override anytime:
///   `--dart-define=API_BASE_URL=http://YOUR_PC_IP:5000`
class ApiConstants {
  static const String _envUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static const String productionUrl = 'https://build-flow-inzo.onrender.com';
  static const String androidEmulatorLocalUrl = 'http://10.0.2.2:5000';
  static const String desktopLocalUrl = 'http://127.0.0.1:5000';

  static String get baseUrl {
    if (_envUrl.isNotEmpty) return _envUrl;
    if (kDebugMode) {
      // Chrome / Windows desktop debug → localhost
      if (kIsWeb ||
          defaultTargetPlatform == TargetPlatform.windows ||
          defaultTargetPlatform == TargetPlatform.linux ||
          defaultTargetPlatform == TargetPlatform.macOS) {
        return desktopLocalUrl;
      }
      // Android / iOS emulator debug → host machine
      return androidEmulatorLocalUrl;
    }
    return productionUrl;
  }
}
