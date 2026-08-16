import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:construction_material_mobile_app/core/network/api_client.dart';
import 'package:construction_material_mobile_app/core/utils/api_error.dart';

class PagedResult<T> {
  final List<T> items;
  final int currentPage;
  final int totalPages;
  final int total;

  const PagedResult({
    required this.items,
    this.currentPage = 1,
    this.totalPages = 1,
    this.total = 0,
  });
}

class ApiRepository {
  final ApiClient api;

  ApiRepository(this.api);

  Future<Map<String, dynamic>> _get(
    String path, {
    Map<String, dynamic>? params,
  }) async {
    try {
      final res = await api.dio.get(path, queryParameters: params);
      return Map<String, dynamic>.from(res.data as Map);
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<Map<String, dynamic>> _post(String path, {dynamic data}) async {
    try {
      final res = await api.dio.post(path, data: data);
      return Map<String, dynamic>.from(res.data as Map);
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<Map<String, dynamic>> _put(String path, {dynamic data}) async {
    try {
      final res = await api.dio.put(path, data: data);
      return Map<String, dynamic>.from(res.data as Map);
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<Map<String, dynamic>> _delete(String path) async {
    try {
      final res = await api.dio.delete(path);
      return Map<String, dynamic>.from(res.data as Map);
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  PagedResult<Map<String, dynamic>> _parsePage(
    Map<String, dynamic> data,
    String listKey, [
    String totalKey = 'total',
  ]) {
    final raw = data[listKey];
    final items = raw is List
        ? raw.map((e) => Map<String, dynamic>.from(e as Map)).toList()
        : <Map<String, dynamic>>[];
    return PagedResult(
      items: items,
      currentPage: (data['currentPage'] as num?)?.toInt() ?? 1,
      totalPages: (data['totalPages'] as num?)?.toInt() ?? 1,
      total: (data[totalKey] as num?)?.toInt() ?? items.length,
    );
  }

  void _ensureSuccess(
    Map<String, dynamic> data, [
    String fallback = 'Request failed',
  ]) {
    if (data['success'] != true) {
      throw Exception(data['error']?.toString() ?? fallback);
    }
  }

  // ── Users ──────────────────────────────────────────────────────────────

  Future<PagedResult<Map<String, dynamic>>> getUsers({
    int page = 1,
    int limit = 20,
    String? search,
    String? role,
  }) async {
    final data = await _get(
      '/api/users',
      params: {
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        if (role != null && role.isNotEmpty) 'role': role,
      },
    );
    _ensureSuccess(data);
    return _parsePage(data, 'users', 'totalUsers');
  }

  Future<Map<String, dynamic>> createUser(Map<String, dynamic> body) async {
    final data = await _post('/api/users', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['user'] as Map);
  }

  Future<Map<String, dynamic>> updateUserStatus(
    String id,
    String status,
  ) async {
    final data = await _put('/api/users/$id/status', data: {'status': status});
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['user'] as Map);
  }

  Future<Map<String, dynamic>> updateUserRole(
    String id, {
    required String role,
    String? vehiclePlateCode,
  }) async {
    final data = await _put(
      '/api/users/$id/role',
      data: {
        'role': role,
        if (vehiclePlateCode != null) 'vehiclePlateCode': vehiclePlateCode,
      },
    );
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['user'] as Map);
  }

  Future<void> deleteUser(String id) async {
    final data = await _delete('/api/users/$id');
    _ensureSuccess(data);
  }

  Future<List<String>> getUserRoles() async {
    final data = await _get('/api/users/roles');
    _ensureSuccess(data);
    final raw = data['roles'] as List? ?? const [];
    final names = <String>{};
    for (final e in raw) {
      if (e is Map) {
        final name = (e['name'] ?? '').toString().trim();
        if (name.isNotEmpty) names.add(name);
      } else {
        final name = e.toString().trim();
        if (name.isNotEmpty) names.add(name);
      }
    }
    return names.toList()..sort();
  }

  // ── Projects ───────────────────────────────────────────────────────────

  Future<PagedResult<Map<String, dynamic>>> getProjects({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
  }) async {
    final data = await _get(
      '/api/projects',
      params: {
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        if (status != null && status.isNotEmpty) 'status': status,
      },
    );
    _ensureSuccess(data);
    return _parsePage(data, 'projects', 'totalProjects');
  }

  Future<Map<String, dynamic>> saveProject(
    Map<String, dynamic> body, {
    String? id,
  }) async {
    final data = id == null
        ? await _post('/api/projects', data: body)
        : await _put('/api/projects/$id', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['project'] as Map);
  }

  Future<void> deleteProject(String id) async {
    final data = await _delete('/api/projects/$id');
    _ensureSuccess(data);
  }

  /// Project budget total / used / remaining (from material requests).
  Future<Map<String, dynamic>> getProjectBudget(String projectId) async {
    final data = await _get('/api/projects/$projectId/budget');
    _ensureSuccess(data);
    return {
      'budget': (data['budget'] as num?)?.toDouble() ?? 0,
      'used': (data['used'] as num?)?.toDouble() ?? 0,
      'remaining': (data['remaining'] as num?)?.toDouble() ?? 0,
      'projectName': data['projectName']?.toString() ?? '',
    };
  }

  // ── Categories ─────────────────────────────────────────────────────────

  Future<PagedResult<Map<String, dynamic>>> getCategories({
    int page = 1,
    int limit = 20,
    String? search,
  }) async {
    final data = await _get(
      '/api/categories',
      params: {
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
    _ensureSuccess(data);
    return _parsePage(data, 'categories', 'totalCategories');
  }

  Future<Map<String, dynamic>> saveCategory(
    Map<String, dynamic> body, {
    String? id,
  }) async {
    final data = id == null
        ? await _post('/api/categories', data: body)
        : await _put('/api/categories/$id', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['category'] as Map);
  }

  Future<void> deleteCategory(String id) async {
    final data = await _delete('/api/categories/$id');
    _ensureSuccess(data);
  }

  // ── Suppliers ──────────────────────────────────────────────────────────

  Future<PagedResult<Map<String, dynamic>>> getSuppliers({
    int page = 1,
    int limit = 20,
    String? search,
  }) async {
    final data = await _get(
      '/api/suppliers',
      params: {
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
    _ensureSuccess(data);
    return _parsePage(data, 'suppliers', 'totalSuppliers');
  }

  Future<List<Map<String, dynamic>>> getAllSuppliers() async {
    final page = await getSuppliers(limit: 200);
    return page.items;
  }

  Future<Map<String, dynamic>> saveSupplier(
    Map<String, dynamic> body, {
    String? id,
  }) async {
    final data = id == null
        ? await _post('/api/suppliers', data: body)
        : await _put('/api/suppliers/$id', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['supplier'] as Map);
  }

  Future<void> deleteSupplier(String id) async {
    final data = await _delete('/api/suppliers/$id');
    _ensureSuccess(data);
  }

  // ── Materials ──────────────────────────────────────────────────────────

  Future<PagedResult<Map<String, dynamic>>> getMaterials({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
  }) async {
    final data = await _get(
      '/api/materials',
      params: {
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null && category.isNotEmpty) 'category': category,
      },
    );
    _ensureSuccess(data);
    return _parsePage(data, 'materials', 'totalMaterials');
  }

  Future<Map<String, dynamic>> saveMaterial(
    Map<String, dynamic> body, {
    String? id,
    String? imagePath,
  }) async {
    try {
      final form = FormData.fromMap({
        'name': body['name'],
        'category': body['category'],
        'unit': body['unit'],
        'estimatedPrice': body['estimatedPrice'].toString(),
        'suppliers': jsonEncode(body['suppliers'] ?? []),
        if (body['currentStock'] != null)
          'currentStock': body['currentStock'].toString(),
        if (body['minimumStock'] != null)
          'minimumStock': body['minimumStock'].toString(),
        if (body['status'] != null) 'status': body['status'],
        if (body['description'] != null) 'description': body['description'],
      });
      if (imagePath != null && imagePath.isNotEmpty) {
        form.files.add(
          MapEntry(
            'image',
            await MultipartFile.fromFile(
              imagePath,
              filename: imagePath.split(RegExp(r'[\\/]')).last,
            ),
          ),
        );
      }
      final res = id == null
          ? await api.dio.post('/api/materials', data: form)
          : await api.dio.put('/api/materials/$id', data: form);
      final data = Map<String, dynamic>.from(res.data as Map);
      _ensureSuccess(data);
      return Map<String, dynamic>.from(data['material'] as Map);
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<void> deleteMaterial(String id) async {
    final data = await _delete('/api/materials/$id');
    _ensureSuccess(data);
  }

  // ── Requests ───────────────────────────────────────────────────────────

  Future<PagedResult<Map<String, dynamic>>> getRequests({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
    bool grouped = false,
  }) async {
    final data = await _get(
      '/api/requests',
      params: {
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        if (status != null && status.isNotEmpty) 'status': status,
        if (grouped) 'grouped': 'true',
      },
    );
    _ensureSuccess(data);
    return _parsePage(data, 'requests', 'totalRequests');
  }

  Future<Map<String, dynamic>> getRequest(String id) async {
    final data = await _get('/api/requests/$id');
    _ensureSuccess(data);
    return {
      'request': Map<String, dynamic>.from(data['request'] as Map),
      if (data['approvals'] != null)
        'approvals': (data['approvals'] as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
    };
  }

  Future<Map<String, dynamic>> createRequest(Map<String, dynamic> body) async {
    final data = await _post('/api/requests', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['request'] as Map);
  }

  /// One submit for several material lines (PM reviews them together).
  Future<Map<String, dynamic>> createRequestBatch(
    Map<String, dynamic> body,
  ) async {
    final data = await _post('/api/requests/batch', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data);
  }

  /// Site Engineer revises Pending/Returned request (resets to Pending).
  Future<Map<String, dynamic>> updateRequest(
    String id,
    Map<String, dynamic> body,
  ) async {
    final data = await _put('/api/requests/$id', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['request'] as Map);
  }

  Future<Map<String, dynamic>> reviewRequest(
    String id, {
    required String action,
    required String comments,
    List<String>? suppliers,
  }) async {
    final data = await _put(
      '/api/requests/$id/review',
      data: {
        'action': action,
        'comments': comments,
        if (suppliers != null) 'suppliers': suppliers,
      },
    );
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['request'] as Map);
  }

  Future<Map<String, dynamic>> bulkReviewRequests({
    required List<String> requestIds,
    required String action,
    required String comments,
    List<String>? suppliers,
  }) async {
    final data = await _put(
      '/api/requests/bulk-review',
      data: {
        'requestIds': requestIds,
        'action': action,
        'comments': comments,
        if (suppliers != null) 'suppliers': suppliers,
      },
    );
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data);
  }

  Future<Map<String, dynamic>> receiveRequest(
    String id, {
    int damagedQuantity = 0,
    int missingQuantity = 0,
    String damagedComments = '',
    String missingComments = '',
  }) async {
    final data = await _put(
      '/api/requests/$id/receive',
      data: {
        'damagedQuantity': damagedQuantity,
        'missingQuantity': missingQuantity,
        'damagedComments': damagedComments,
        'missingComments': missingComments,
        'comments': damagedComments,
      },
    );
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['request'] as Map);
  }

  /// Cancel Pending/Returned request (DELETE → status Cancelled on server).
  Future<void> cancelRequest(String id) async {
    final data = await _delete('/api/requests/$id');
    _ensureSuccess(data);
  }

  @Deprecated('Use cancelRequest')
  Future<void> deleteRequest(String id) => cancelRequest(id);

  // ── Quotations ─────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getQuotations({String? requestId}) async {
    final data = await _get(
      '/api/quotations',
      params: {if (requestId != null) 'requestId': requestId},
    );
    _ensureSuccess(data);
    return (data['quotations'] as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<Map<String, dynamic>> submitQuotation(
    Map<String, dynamic> body,
  ) async {
    final data = await _post('/api/quotations', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['quotation'] as Map);
  }

  Future<Map<String, dynamic>> submitQuotationBatch(
    Map<String, dynamic> body,
  ) async {
    final data = await _post('/api/quotations/batch', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data);
  }

  Future<Map<String, dynamic>> updateQuotationBatch(
    Map<String, dynamic> body,
  ) async {
    final data = await _put('/api/quotations/batch', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data);
  }

  Future<Map<String, dynamic>> declineQuotation({
    required String materialRequestId,
    String reason = 'No stock',
    String? notes,
  }) async {
    final data = await _post('/api/quotations/decline', data: {
      'materialRequest': materialRequestId,
      'reason': reason,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data);
  }

  Future<Map<String, dynamic>> getMySupplier() async {
    final data = await _get('/api/suppliers/me');
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['supplier'] as Map);
  }

  Future<Map<String, dynamic>> updateMySupplier(Map<String, dynamic> body) async {
    final data = await _put('/api/suppliers/me', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['supplier'] as Map);
  }

  Future<Map<String, dynamic>> selectQuotation(String id) async {
    final data = await _put('/api/quotations/$id/select');
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['po'] as Map? ?? data);
  }

  // ── Orders ─────────────────────────────────────────────────────────────

  Future<PagedResult<Map<String, dynamic>>> getOrders({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
    String? paymentStatus,
  }) async {
    final data = await _get(
      '/api/orders',
      params: {
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        if (status != null && status.isNotEmpty) 'status': status,
        if (paymentStatus != null && paymentStatus.isNotEmpty)
          'paymentStatus': paymentStatus,
      },
    );
    _ensureSuccess(data);
    return _parsePage(data, 'orders', 'totalOrders');
  }

  Future<Map<String, dynamic>> getOrder(String id) async {
    final data = await _get('/api/orders/$id');
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['order'] as Map);
  }

  Future<Map<String, dynamic>> updateOrderStatus(
    String id,
    String status,
  ) async {
    final data = await _put('/api/orders/$id/status', data: {'status': status});
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['order'] as Map);
  }

  /// Edit PO qty / price / tax / discount / status (Admin + Procurement).
  Future<Map<String, dynamic>> updateOrder(
    String id,
    Map<String, dynamic> body,
  ) async {
    final data = await _put('/api/orders/$id', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['order'] as Map);
  }

  Future<Map<String, dynamic>> uploadInvoice(
    String id, {
    String? invoicePath,
    String? invoiceFile,
  }) async {
    try {
      dynamic payload;
      if (invoicePath != null && invoicePath.isNotEmpty) {
        payload = FormData.fromMap({
          'invoice': await MultipartFile.fromFile(
            invoicePath,
            filename: invoicePath.split(RegExp(r'[\\/]')).last,
          ),
        });
      } else {
        payload = {'invoiceFile': invoiceFile ?? ''};
      }
      final res = await api.dio.put('/api/orders/$id/invoice', data: payload);
      final data = Map<String, dynamic>.from(res.data as Map);
      _ensureSuccess(data);
      return Map<String, dynamic>.from(data['order'] as Map);
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  /// One-click PDF invoice from PO data (no Word / file needed).
  Future<Map<String, dynamic>> generateInvoice(String id) async {
    final data = await _post('/api/orders/$id/generate-invoice');
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['order'] as Map);
  }

  Future<void> deleteOrder(String id) async {
    final data = await _delete('/api/orders/$id');
    _ensureSuccess(data);
  }

  // ── Payments ───────────────────────────────────────────────────────────

  Future<PagedResult<Map<String, dynamic>>> getPayments({
    int page = 1,
    int limit = 20,
  }) async {
    final data = await _get(
      '/api/payments',
      params: {'page': page, 'limit': limit},
    );
    _ensureSuccess(data);
    return _parsePage(data, 'payments', 'totalPayments');
  }

  Future<Map<String, dynamic>> getPaymentSummary() async {
    final data = await _get('/api/payments/summary');
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['summary'] as Map? ?? data);
  }

  Future<Map<String, dynamic>> recordPayment(
    Map<String, dynamic> body, {
    String? receiptPath,
  }) async {
    // WaafiPay waits for handset PIN — allow longer than default 30s.
    try {
      Object payload = body;
      if (receiptPath != null && receiptPath.isNotEmpty) {
        payload = FormData.fromMap({
          'purchaseOrder': body['purchaseOrder'],
          'paidAmount': body['paidAmount'],
          'paymentMethod': body['paymentMethod'],
          if (body['accountNo'] != null) 'accountNo': body['accountNo'],
          if (body['referenceNumber'] != null)
            'referenceNumber': body['referenceNumber'],
          'receipt': await MultipartFile.fromFile(
            receiptPath,
            filename: receiptPath.split(RegExp(r'[\\/]')).last,
          ),
        });
      }
      final res = await api.dio.post(
        '/api/payments',
        data: payload,
        options: Options(
          sendTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 120),
        ),
      );
      final data = Map<String, dynamic>.from(res.data as Map);
      _ensureSuccess(data);
      return Map<String, dynamic>.from(data['payment'] as Map);
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  // ── Deliveries ─────────────────────────────────────────────────────────

  Future<PagedResult<Map<String, dynamic>>> getDeliveries({
    int page = 1,
    int limit = 20,
    String? status,
    String? fromDate,
    String? toDate,
  }) async {
    final data = await _get(
      '/api/deliveries',
      params: {
        'page': page,
        'limit': limit,
        if (status != null && status.isNotEmpty) 'status': status,
        if (fromDate != null && fromDate.isNotEmpty) 'fromDate': fromDate,
        if (toDate != null && toDate.isNotEmpty) 'toDate': toDate,
      },
    );
    _ensureSuccess(data);
    return _parsePage(data, 'deliveries', 'totalDeliveries');
  }

  Future<Map<String, dynamic>> scheduleDelivery(
    Map<String, dynamic> body,
  ) async {
    final data = await _post('/api/deliveries', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['delivery'] as Map);
  }

  Future<Map<String, dynamic>> updateDeliveryStatus(
    String id,
    String status,
  ) async {
    final data = await _put(
      '/api/deliveries/$id/status',
      data: {'status': status},
    );
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['delivery'] as Map);
  }

  Future<Map<String, dynamic>> rescheduleDelivery(
    String id,
    Map<String, dynamic> body,
  ) async {
    final data = await _put('/api/deliveries/$id/reschedule', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['delivery'] as Map);
  }

  Future<Map<String, dynamic>> uploadDeliveryNote(
    String id, {
    String? notePath,
    String? deliveryNoteFile,
  }) async {
    try {
      dynamic payload;
      if (notePath != null && notePath.isNotEmpty) {
        payload = FormData.fromMap({
          'deliveryNote': await MultipartFile.fromFile(
            notePath,
            filename: notePath.split(RegExp(r'[\\/]')).last,
          ),
        });
      } else {
        payload = {'deliveryNoteFile': deliveryNoteFile ?? ''};
      }
      final res = await api.dio.put('/api/deliveries/$id/note', data: payload);
      final data = Map<String, dynamic>.from(res.data as Map);
      _ensureSuccess(data);
      return Map<String, dynamic>.from(data['delivery'] as Map);
    } catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<void> deleteDelivery(String id) async {
    final data = await _delete('/api/deliveries/$id');
    _ensureSuccess(data);
  }

  // ── Inventory ──────────────────────────────────────────────────────────

  Future<PagedResult<Map<String, dynamic>>> getInventoryLedger({
    int page = 1,
    int limit = 20,
  }) async {
    final data = await _get(
      '/api/inventory',
      params: {'page': page, 'limit': limit},
    );
    _ensureSuccess(data);
    return _parsePage(data, 'logs', 'totalLogs');
  }

  Future<List<Map<String, dynamic>>> getInventoryAlerts() async {
    final data = await _get('/api/inventory/alerts');
    _ensureSuccess(data);
    return (data['alerts'] as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<Map<String, dynamic>> adjustStock(Map<String, dynamic> body) async {
    final data = await _post('/api/inventory/adjust', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(data['log'] as Map);
  }

  Future<({List<Map<String, dynamic>> stocks, List<Map<String, dynamic>> projects})>
      getProjectStock({String? projectId}) async {
    final data = await _get(
      '/api/inventory/project-stock',
      params: {
        if (projectId != null && projectId.isNotEmpty) 'projectId': projectId,
      },
    );
    _ensureSuccess(data);
    final stocks = (data['stocks'] as List? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final projects = (data['projects'] as List? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    return (stocks: stocks, projects: projects);
  }

  Future<Map<String, dynamic>> recordSiteUsage(Map<String, dynamic> body) async {
    final data = await _post('/api/inventory/site-usage', data: body);
    _ensureSuccess(data);
    return Map<String, dynamic>.from(
      (data['stock'] as Map?) ?? <String, dynamic>{},
    );
  }

  // ── Notifications ──────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getNotifications() async {
    final data = await _get('/api/notifications');
    _ensureSuccess(data);
    return (data['notifications'] as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<void> markNotificationRead(String id) async {
    final data = await _put('/api/notifications/$id/read');
    _ensureSuccess(data);
  }

  Future<void> markAllNotificationsRead() async {
    final data = await _put('/api/notifications/read-all');
    _ensureSuccess(data);
  }

  // ── Dashboards ─────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getAdminDashboard() async {
    final data = await _get('/api/dashboard/admin');
    _ensureSuccess(data);
    return data;
  }

  Future<Map<String, dynamic>> getSiteEngineerDashboard() async {
    final data = await _get('/api/dashboard/site-engineer');
    _ensureSuccess(data);
    return data;
  }

  Future<Map<String, dynamic>> getProjectManagerDashboard() async {
    final data = await _get('/api/dashboard/project-manager');
    _ensureSuccess(data);
    return data;
  }

  Future<Map<String, dynamic>> getProcurementDashboard() async {
    final data = await _get('/api/dashboard/procurement');
    _ensureSuccess(data);
    return data;
  }

  Future<Map<String, dynamic>> getDeliveryStaffDashboard() async {
    final data = await _get('/api/dashboard/delivery-staff');
    _ensureSuccess(data);
    return data;
  }

  // ── Audit & Reports ────────────────────────────────────────────────────

  Future<PagedResult<Map<String, dynamic>>> getAuditLogs({
    int page = 1,
    int limit = 20,
    String? search,
    String? role,
    String? action,
  }) async {
    final data = await _get(
      '/api/audit',
      params: {
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        if (role != null && role.isNotEmpty) 'role': role,
        if (action != null && action.isNotEmpty) 'action': action,
      },
    );
    _ensureSuccess(data);
    return _parsePage(data, 'logs', 'totalLogs');
  }

  Future<Map<String, dynamic>> getReports({
    String? month,
    bool supplierView = false,
  }) async {
    final data = await _get(
      supplierView ? '/api/reports/supplier' : '/api/reports',
      params: {
        if (month != null && month.isNotEmpty) 'month': month,
      },
    );
    _ensureSuccess(data);
    return data;
  }
}
