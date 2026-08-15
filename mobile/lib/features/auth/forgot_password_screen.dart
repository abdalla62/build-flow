import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:construction_material_mobile_app/core/theme/app_theme.dart';
import 'package:construction_material_mobile_app/providers/app_providers.dart';

String? _tokenFromResetUrl(String? url) {
  if (url == null || url.isEmpty) return null;
  final uri = Uri.tryParse(url);
  if (uri == null) return null;
  final segments = uri.pathSegments;
  final i = segments.indexOf('reset-password');
  if (i >= 0 && i + 1 < segments.length) {
    final token = segments[i + 1];
    return token.isEmpty ? null : token;
  }
  return null;
}

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  String? _message;
  bool _done = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (ref.read(authNotifierProvider).state.busy) return;
    if (_email.text.trim().isEmpty) return;
    final result = await ref.read(authNotifierProvider).forgotPassword(_email.text);
    if (!mounted) return;
    if (result == null) {
      setState(() {
        _done = false;
        _message = ref.read(authNotifierProvider).state.error;
      });
      return;
    }

    final token = _tokenFromResetUrl(result.resetUrl);
    if (token != null) {
      context.go('/reset-password/$token');
      return;
    }

    setState(() {
      _done = true;
      _message = result.message;
    });
  }

  @override
  Widget build(BuildContext context) {
    final busy = ref.watch(authNotifierProvider).state.busy;

    return Scaffold(
      appBar: AppBar(title: const Text('Forgot Password')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!_done) ...[
                const Text(
                  'Enter your email to continue and set a new password.',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                ),
                if (_message != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _message!,
                    style: const TextStyle(color: AppColors.danger),
                  ),
                ],
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: busy ? null : _submit,
                  child: busy
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Continue'),
                ),
              ] else ...[
                const Icon(
                  Icons.mark_email_read_outlined,
                  size: 56,
                  color: AppColors.success,
                ),
                const SizedBox(height: 16),
                Text(
                  'Check your inbox',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  _message ??
                      'If an account exists for that email, reset instructions were sent.',
                  style: const TextStyle(color: AppColors.textSecondary),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => context.go('/login'),
                child: const Text('Back to login'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
