import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:construction_material_mobile_app/core/network/api_client.dart';
import 'package:construction_material_mobile_app/models/user_model.dart';
import 'package:construction_material_mobile_app/services/auth_repository.dart';
import 'package:construction_material_mobile_app/services/api_repository.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  throw UnimplementedError('apiClientProvider must be overridden in main()');
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(apiClientProvider));
});

final apiRepositoryProvider = Provider<ApiRepository>((ref) {
  return ApiRepository(ref.watch(apiClientProvider));
});

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final UserModel? user;
  final String? error;
  final bool busy;

  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.error,
    this.busy = false,
  });

  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    String? error,
    bool? busy,
    bool clearUser = false,
    bool clearError = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: clearUser ? null : (user ?? this.user),
      error: clearError ? null : (error ?? this.error),
      busy: busy ?? this.busy,
    );
  }
}

class AuthNotifier extends ChangeNotifier {
  final AuthRepository _repo;
  AuthState state = const AuthState();

  AuthNotifier(this._repo);

  Future<void> bootstrap() async {
    state = state.copyWith(status: AuthStatus.unknown);
    notifyListeners();
    try {
      // Bound wait so splash cannot hang forever if the API is slow/unreachable.
      final user = await _repo.me().timeout(const Duration(seconds: 12));
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      // Do NOT call network logout here: /api/auth/logout is protected.
      // Clear local session without awaiting storage (can hang on some emulators).
      state = const AuthState(status: AuthStatus.unauthenticated);
      notifyListeners();
      // ignore: unawaited_futures
      _repo.clearLocalSession();
      return;
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(busy: true, clearError: true);
    notifyListeners();
    try {
      final user = await _repo.login(email, password);
      state = AuthState(status: AuthStatus.authenticated, user: user);
      notifyListeners();
      return true;
    } catch (e) {
      state = AuthState(
        status: AuthStatus.unauthenticated,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    state = state.copyWith(busy: true);
    notifyListeners();
    await _repo.logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
    notifyListeners();
  }

  Future<({String message, String? resetUrl})?> forgotPassword(String email) async {
    state = state.copyWith(busy: true, clearError: true);
    notifyListeners();
    try {
      final result = await _repo.forgotPassword(email);
      state = state.copyWith(busy: false);
      notifyListeners();
      return result;
    } catch (e) {
      state = state.copyWith(
        busy: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
      notifyListeners();
      return null;
    }
  }

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    state = state.copyWith(busy: true, clearError: true);
    notifyListeners();
    try {
      await _repo.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
      state = state.copyWith(busy: false);
      notifyListeners();
      return true;
    } catch (e) {
      state = state.copyWith(
        busy: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateProfile({
    required String name,
    required String email,
    String? avatarPath,
    bool removeAvatar = false,
  }) async {
    state = state.copyWith(busy: true, clearError: true);
    notifyListeners();
    try {
      final user = await _repo.updateProfile(
        name: name,
        email: email,
        avatarPath: avatarPath,
        removeAvatar: removeAvatar,
      );
      state = state.copyWith(busy: false, user: user);
      notifyListeners();
      return true;
    } catch (e) {
      state = state.copyWith(
        busy: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
      notifyListeners();
      return false;
    }
  }
}

final authNotifierProvider = ChangeNotifierProvider<AuthNotifier>((ref) {
  return AuthNotifier(ref.watch(authRepositoryProvider));
});

/// Matches web AuthContext: persisted `theme` = 'light' | 'dark'.
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.light);

Future<void> loadPersistedTheme(ProviderContainer container) async {
  final prefs = await SharedPreferences.getInstance();
  final stored = prefs.getString('theme') ?? 'light';
  container.read(themeModeProvider.notifier).state =
      stored == 'dark' ? ThemeMode.dark : ThemeMode.light;
}

Future<void> togglePersistedTheme(WidgetRef ref, bool currentlyDark) async {
  final next = currentlyDark ? ThemeMode.light : ThemeMode.dark;
  ref.read(themeModeProvider.notifier).state = next;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('theme', next == ThemeMode.dark ? 'dark' : 'light');
}
