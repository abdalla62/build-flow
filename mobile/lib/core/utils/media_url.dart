import 'package:construction_material_mobile_app/core/constants/api_constants.dart';
import 'package:flutter/material.dart';

String? mediaUrl(String? path) {
  if (path == null) return null;
  final p = path.trim();
  if (p.isEmpty) return null;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  final base = ApiConstants.baseUrl.replaceAll(RegExp(r'/$'), '');
  return p.startsWith('/') ? '$base$p' : '$base/$p';
}

/// Safe network avatar — never throws when path is empty/invalid.
ImageProvider? mediaImageProvider(String? path) {
  final url = mediaUrl(path);
  if (url == null) return null;
  return NetworkImage(url);
}
