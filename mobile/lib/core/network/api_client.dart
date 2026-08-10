import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';
import 'package:construction_material_mobile_app/core/constants/api_constants.dart';

/// Dio client with PersistCookieJar + Bearer JWT (same backend auth).
class ApiClient {
  late final Dio dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  PersistCookieJar? _cookieJar;
  String? _token;

  ApiClient();

  Future<void> init() async {
    final dir = await getApplicationDocumentsDirectory();
    final cookiePath = Directory('${dir.path}/.cookies');
    if (!await cookiePath.exists()) {
      await cookiePath.create(recursive: true);
    }
    _cookieJar = PersistCookieJar(storage: FileStorage(cookiePath.path));
    _token = await _storage.read(key: 'bf_token');

    dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        // Render free tier can cold-start; allow extra time to connect.
        connectTimeout: const Duration(seconds: 60),
        receiveTimeout: const Duration(seconds: 60),

        headers: {'Accept': 'application/json'},
      ),
    );
    dio.interceptors.add(CookieManager(_cookieJar!));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_token != null && _token!.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $_token';
          }
          handler.next(options);
        },
      ),
    );
  }

  Future<void> setToken(String? token) async {
    _token = token;
    if (token == null || token.isEmpty) {
      await _storage.delete(key: 'bf_token');
    } else {
      await _storage.write(key: 'bf_token', value: token);
    }
  }

  Future<void> clearSession() async {
    await setToken(null);
    await _cookieJar?.deleteAll();
  }
}
