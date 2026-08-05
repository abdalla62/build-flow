/// API base URL configuration.
///
/// Android emulator → host machine: `http://10.0.2.2:5000`
/// Physical device: `--dart-define=API_BASE_URL=http://YOUR_PC_IP:5000`
/// Desktop/Chrome: `--dart-define=API_BASE_URL=http://127.0.0.1:5000`
class ApiConstants {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5000',
  );
}
