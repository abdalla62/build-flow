/// API base URL configuration.
///
/// Default = production Render (same data as web).
/// Override for local backend:
///   Android emulator: `--dart-define=API_BASE_URL=http://10.0.2.2:5000`
///   Physical device:  `--dart-define=API_BASE_URL=http://YOUR_PC_IP:5000`
///   Desktop/Chrome:   `--dart-define=API_BASE_URL=http://127.0.0.1:5000`
class ApiConstants {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://build-flow-inzo.onrender.com',
  );
}
