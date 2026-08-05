import 'package:dio/dio.dart';
import 'package:construction_material_mobile_app/core/network/api_client.dart';
import 'package:construction_material_mobile_app/core/utils/api_error.dart';
import 'package:construction_material_mobile_app/models/user_model.dart';

class AuthRepository {
  final ApiClient api;

  AuthRepository(this.api);

  Future<UserModel> login(String email, String password) async {
    try {
      final res = await api.dio.post(
        '/api/auth/login',
        data: {'email': email.trim(), 'password': password},
      );
      final data = res.data as Map<String, dynamic>;
      if (data['success'] != true) {
        throw Exception(data['error'] ?? 'Login failed');
      }
      final token = data['token']?.toString();
      await api.setToken(token);
      return UserModel.fromJson(Map<String, dynamic>.from(data['user'] as Map));
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<UserModel> me() async {
    try {
      final res = await api.dio.get('/api/auth/me');
      final data = res.data as Map<String, dynamic>;
      if (data['success'] != true) {
        throw Exception(data['error'] ?? 'Session invalid');
      }
      return UserModel.fromJson(Map<String, dynamic>.from(data['user'] as Map));
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<void> clearLocalSession() async {
    await api.clearSession();
  }

  Future<void> logout() async {
    try {
      await api.dio.get('/api/auth/logout');
    } catch (_) {}
    await api.clearSession();
  }

  Future<String> forgotPassword(String email) async {
    try {
      final res = await api.dio.post(
        '/api/auth/forgot-password',
        data: {'email': email.trim()},
      );
      final data = res.data as Map<String, dynamic>;
      if (data['success'] != true) {
        throw Exception(data['error'] ?? 'Request failed');
      }
      return (data['message'] ?? 'If the account exists, a reset link was sent.')
          .toString();
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<void> resetPassword(String token, String password) async {
    try {
      final res = await api.dio.put(
        '/api/auth/reset-password/$token',
        data: {'password': password},
      );
      final data = res.data as Map<String, dynamic>;
      if (data['success'] != true) {
        throw Exception(data['error'] ?? 'Reset failed');
      }
      final newToken = data['token']?.toString();
      if (newToken != null) await api.setToken(newToken);
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final res = await api.dio.put(
        '/api/auth/change-password',
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        },
      );
      final data = res.data as Map<String, dynamic>;
      if (data['success'] != true) {
        throw Exception(data['error'] ?? 'Failed to change password');
      }
      final token = data['token']?.toString();
      if (token != null) await api.setToken(token);
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<UserModel> updateProfile({
    required String name,
    required String email,
    String? avatarPath,
    bool removeAvatar = false,
  }) async {
    try {
      final form = FormData.fromMap({
        'name': name.trim(),
        'email': email.trim(),
        if (removeAvatar) 'removeAvatar': 'true',
      });
      if (avatarPath != null && avatarPath.isNotEmpty) {
        form.files.add(
          MapEntry(
            'avatar',
            await MultipartFile.fromFile(
              avatarPath,
              filename: avatarPath.split(RegExp(r'[\\/]')).last,
            ),
          ),
        );
      }
      final res = await api.dio.put('/api/auth/profile', data: form);
      final data = res.data as Map<String, dynamic>;
      if (data['success'] != true) {
        throw Exception(data['error'] ?? 'Profile update failed');
      }
      return UserModel.fromJson(Map<String, dynamic>.from(data['user'] as Map));
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }
}
