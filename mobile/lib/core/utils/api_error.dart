import 'package:dio/dio.dart';

String apiErrorMessage(Object e, [String fallback = 'Request failed']) {
  if (e is DioException) {
    final data = e.response?.data;
    if (data is Map) {
      if (data['error'] != null) return data['error'].toString();
      if (data['errors'] is List && (data['errors'] as List).isNotEmpty) {
        final first = (data['errors'] as List).first;
        if (first is Map && first['msg'] != null) return first['msg'].toString();
        return first.toString();
      }
    }
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return 'Cannot reach server. Is backend running? Check API_BASE_URL.';
    }
    return e.message ?? fallback;
  }
  return e.toString().replaceFirst('Exception: ', '');
}
