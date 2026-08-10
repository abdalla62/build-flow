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

/// Prefer [UserAvatar] for UI — NetworkImage throws on 404 and floods the console.
@Deprecated('Use UserAvatar instead to avoid 404 console spam')
ImageProvider? mediaImageProvider(String? path) {
  final url = mediaUrl(path);
  if (url == null) return null;
  return NetworkImage(url);
}

/// Circle avatar that falls back to initials when the image is missing (404).
class UserAvatar extends StatelessWidget {
  final String? avatarPath;
  final String initial;
  final double radius;
  final Color? backgroundColor;
  final TextStyle? initialStyle;
  final ImageProvider? localImage;

  const UserAvatar({
    super.key,
    required this.avatarPath,
    required this.initial,
    this.radius = 16,
    this.backgroundColor,
    this.initialStyle,
    this.localImage,
  });

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ??
        Theme.of(context).colorScheme.primary.withValues(alpha: 0.2);
    final fallback = Text(
      initial,
      style: initialStyle ??
          TextStyle(
            fontSize: radius * 0.8,
            fontWeight: FontWeight.w800,
          ),
    );

    if (localImage != null) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: bg,
        backgroundImage: localImage,
      );
    }

    final url = mediaUrl(avatarPath);
    if (url == null) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: bg,
        child: fallback,
      );
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: bg,
      child: ClipOval(
        child: Image.network(
          url,
          width: radius * 2,
          height: radius * 2,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Center(child: fallback),
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return Center(
              child: SizedBox(
                width: radius,
                height: radius,
                child: const CircularProgressIndicator(strokeWidth: 2),
              ),
            );
          },
        ),
      ),
    );
  }
}
