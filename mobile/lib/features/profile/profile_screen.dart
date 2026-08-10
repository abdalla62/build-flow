import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:construction_material_mobile_app/core/theme/app_scroll_behavior.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/core/utils/media_url.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';

/// Matches web `Profile.jsx`: Personal Information + Security Settings.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _currentPw = TextEditingController();
  final _newPw = TextEditingController();
  final _confirmPw = TextEditingController();

  String? _avatarPath;
  bool _removeAvatar = false;
  bool _profileSubmitting = false;
  bool _passwordSubmitting = false;
  bool _showCurrent = false;
  bool _showNew = false;
  bool _showConfirm = false;

  String? _nameError;
  String? _emailError;
  String? _currentPwError;
  String? _newPwError;
  String? _confirmPwError;

  @override
  void initState() {
    super.initState();
    _syncFromUser();
  }

  void _syncFromUser() {
    final user = ref.read(authNotifierProvider).state.user;
    _name.text = user?.name ?? '';
    _email.text = user?.email ?? '';
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _currentPw.dispose();
    _newPw.dispose();
    _confirmPw.dispose();
    super.dispose();
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error ? AppColors.danger : null,
      ),
    );
  }

  /// Opens system file browser (same pattern as invoice / delivery note upload).
  Future<void> _pickAvatar() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp'],
      withData: false,
    );
    if (result == null || result.files.isEmpty) return;

    final file = result.files.single;
    final path = file.path;
    if (path == null || path.isEmpty) {
      _snack('Could not read that file. Try another image.', error: true);
      return;
    }

    final size = file.size;
    if (size > 2 * 1024 * 1024) {
      _snack('Image must be under 2MB', error: true);
      return;
    }

    setState(() {
      _avatarPath = path;
      _removeAvatar = false;
    });
  }

  bool _validateProfile() {
    final name = _name.text.trim();
    final email = _email.text.trim();
    String? nameErr;
    String? emailErr;

    if (name.length < 2) {
      nameErr = 'Full name is required (min 2 characters)';
    }
    if (email.isEmpty || !RegExp(r'^\S+@\S+\.\S+$').hasMatch(email)) {
      emailErr = email.isEmpty ? 'Email is required' : 'Invalid email address';
    }

    setState(() {
      _nameError = nameErr;
      _emailError = emailErr;
    });
    return nameErr == null && emailErr == null;
  }

  Future<void> _saveProfile() async {
    if (!_validateProfile()) return;

    setState(() => _profileSubmitting = true);
    final ok = await ref.read(authNotifierProvider).updateProfile(
          name: _name.text.trim(),
          email: _email.text.trim(),
          avatarPath: _avatarPath,
          removeAvatar: _removeAvatar,
        );
    if (!mounted) return;
    setState(() => _profileSubmitting = false);

    if (ok) {
      setState(() {
        _avatarPath = null;
        _removeAvatar = false;
      });
      _syncFromUser();
      _snack('Profile updated successfully!');
    } else {
      _snack(
        ref.read(authNotifierProvider).state.error ?? 'Update failed',
        error: true,
      );
    }
  }

  bool _validatePassword() {
    final current = _currentPw.text;
    final next = _newPw.text;
    final confirm = _confirmPw.text;
    String? curErr;
    String? newErr;
    String? confErr;

    if (current.trim().isEmpty) {
      curErr = 'Current password is required';
    }
    if (next.isEmpty) {
      newErr = 'New password is required';
    } else if (next.length < 6) {
      newErr = 'Password must be at least 6 characters';
    }
    if (confirm.isEmpty) {
      confErr = 'Confirm password is required';
    } else if (confirm != next) {
      confErr = 'Passwords do not match';
    }

    setState(() {
      _currentPwError = curErr;
      _newPwError = newErr;
      _confirmPwError = confErr;
    });
    return curErr == null && newErr == null && confErr == null;
  }

  Future<void> _changePassword() async {
    if (!_validatePassword()) return;

    setState(() => _passwordSubmitting = true);
    final ok = await ref.read(authNotifierProvider).changePassword(
          currentPassword: _currentPw.text,
          newPassword: _newPw.text,
        );
    if (!mounted) return;
    setState(() => _passwordSubmitting = false);

    if (ok) {
      _currentPw.clear();
      _newPw.clear();
      _confirmPw.clear();
      setState(() {
        _currentPwError = null;
        _newPwError = null;
        _confirmPwError = null;
      });
      _snack('Password updated successfully!');
    } else {
      _snack(
        ref.read(authNotifierProvider).state.error ?? 'Password update failed',
        error: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authNotifierProvider).state.user;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final localImg =
        _avatarPath != null ? FileImage(File(_avatarPath!)) : null;
    final initial =
        (user?.name.isNotEmpty == true ? user!.name[0] : 'U').toUpperCase();
    final hasPhoto = localImg != null ||
        (!_removeAvatar &&
            user?.avatar != null &&
            user!.avatar!.trim().isNotEmpty);

    return ListView(
      physics: kAppScrollPhysics,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: [
        Text(
          'Profile Settings',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
                letterSpacing: -0.4,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          'Manage your personal information and password preferences.',
          style: TextStyle(
            fontSize: 13,
            color: dark ? Colors.white70 : AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 20),

        // —— Personal Information (web Form 1) ——
        _SettingsCard(
          icon: Icons.person_outline_rounded,
          iconBg: AppColors.primary.withValues(alpha: dark ? 0.18 : 0.1),
          iconColor: dark ? AppColors.secondary : AppColors.primary,
          title: 'Personal Information',
          subtitle: 'Update your account name and email address',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'PROFILE PHOTO',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.4,
                  color: dark ? Colors.white60 : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  UserAvatar(
                    avatarPath: _removeAvatar ? null : user?.avatar,
                    initial: initial,
                    radius: 32,
                    localImage: localImg,
                    backgroundColor:
                        AppColors.primary.withValues(alpha: dark ? 0.25 : 0.12),
                    initialStyle: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: dark ? AppColors.secondary : AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        OutlinedButton.icon(
                          onPressed:
                              _profileSubmitting ? null : _pickAvatar,
                          icon: const Icon(Icons.folder_open_outlined, size: 16),
                          label: const Text('Browse files'),
                        ),
                        if (hasPhoto ||
                            (user?.avatar != null &&
                                user!.avatar!.trim().isNotEmpty &&
                                !_removeAvatar))
                          TextButton(
                            onPressed: _profileSubmitting
                                ? null
                                : () => setState(() {
                                      _removeAvatar = true;
                                      _avatarPath = null;
                                    }),
                            child: const Text(
                              'Remove photo',
                              style: TextStyle(
                                color: AppColors.danger,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        Text(
                          'JPG/PNG/WebP, max 2MB — opens file browser',
                          style: TextStyle(
                            fontSize: 10,
                            color: dark
                                ? Colors.white38
                                : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                enabled: !_profileSubmitting,
                decoration: InputDecoration(
                  labelText: 'Full Name',
                  prefixIcon: const Icon(Icons.person_outline, size: 20),
                  errorText: _nameError,
                ),
                onChanged: (_) {
                  if (_nameError != null) setState(() => _nameError = null);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                enabled: !_profileSubmitting,
                decoration: InputDecoration(
                  labelText: 'Email Address',
                  prefixIcon: const Icon(Icons.mail_outline, size: 20),
                  errorText: _emailError,
                ),
                onChanged: (_) {
                  if (_emailError != null) setState(() => _emailError = null);
                },
              ),
              const SizedBox(height: 12),
              InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'System Role',
                  helperText: 'Role cannot be changed here',
                ),
                child: Text(
                  user?.role ?? '—',
                  style: TextStyle(
                    color: dark ? Colors.white60 : AppColors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(height: 18),
              ElevatedButton.icon(
                onPressed: _profileSubmitting ? null : _saveProfile,
                icon: _profileSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.save_outlined, size: 18),
                label: Text(
                  _profileSubmitting ? 'Saving…' : 'Save Details',
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // —— Security Settings (web Form 2) ——
        _SettingsCard(
          icon: Icons.vpn_key_outlined,
          iconBg: AppColors.accent.withValues(alpha: dark ? 0.18 : 0.12),
          iconColor: AppColors.accent,
          title: 'Security Settings',
          subtitle: 'Change your login password credentials',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _currentPw,
                obscureText: !_showCurrent,
                enabled: !_passwordSubmitting,
                decoration: InputDecoration(
                  labelText: 'Current Password',
                  prefixIcon: const Icon(Icons.lock_outline, size: 20),
                  errorText: _currentPwError,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _showCurrent
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      size: 20,
                    ),
                    onPressed: () =>
                        setState(() => _showCurrent = !_showCurrent),
                  ),
                ),
                onChanged: (_) {
                  if (_currentPwError != null) {
                    setState(() => _currentPwError = null);
                  }
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _newPw,
                obscureText: !_showNew,
                enabled: !_passwordSubmitting,
                decoration: InputDecoration(
                  labelText: 'New Password',
                  prefixIcon: const Icon(Icons.lock_outline, size: 20),
                  errorText: _newPwError,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _showNew
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      size: 20,
                    ),
                    onPressed: () => setState(() => _showNew = !_showNew),
                  ),
                ),
                onChanged: (_) {
                  if (_newPwError != null) setState(() => _newPwError = null);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _confirmPw,
                obscureText: !_showConfirm,
                enabled: !_passwordSubmitting,
                decoration: InputDecoration(
                  labelText: 'Confirm New Password',
                  prefixIcon: const Icon(Icons.lock_outline, size: 20),
                  errorText: _confirmPwError,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _showConfirm
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      size: 20,
                    ),
                    onPressed: () =>
                        setState(() => _showConfirm = !_showConfirm),
                  ),
                ),
                onChanged: (_) {
                  if (_confirmPwError != null) {
                    setState(() => _confirmPwError = null);
                  }
                },
              ),
              const SizedBox(height: 18),
              ElevatedButton.icon(
                onPressed: _passwordSubmitting ? null : _changePassword,
                icon: _passwordSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.vpn_key_outlined, size: 18),
                label: Text(
                  _passwordSubmitting ? 'Updating…' : 'Change Password',
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SettingsCard extends StatelessWidget {
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String subtitle;
  final Widget child;

  const _SettingsCard({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: dark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        border: Border.all(
          color: dark ? AppColors.slate700 : AppColors.border,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.darkNavy.withValues(alpha: dark ? 0.25 : 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 11.5,
                        color: dark
                            ? Colors.white54
                            : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Divider(
            height: 28,
            color: dark ? AppColors.slate700 : AppColors.border,
          ),
          child,
        ],
      ),
    );
  }
}
