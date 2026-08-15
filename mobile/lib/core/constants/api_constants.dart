import 'package:flutter/foundation.dart';

/// API base URL configuration.
///
/// - Debug: local backend (same MongoDB as web if `.env` points to Atlas).
///   Android emulator → `http://10.0.2.2:5000`
///   Windows / desktop → `http://127.0.0.1:5000`
/// - Release / profile: production Render.
/// - Override anytime:
///   `--dart-define=API_BASE_URL=https://build-flow-inzo.onrender.com`
///   `--dart-define=API_BASE_URL=http://YOUR_PC_LAN_IP:5000`
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
      if (kIsWeb ||
          defaultTargetPlatform == TargetPlatform.windows ||
          defaultTargetPlatform == TargetPlatform.linux ||
          defaultTargetPlatform == TargetPlatform.macOS) {
        return desktopLocalUrl;
      }
      return androidEmulatorLocalUrl;
    }
    return productionUrl;
  }
}
