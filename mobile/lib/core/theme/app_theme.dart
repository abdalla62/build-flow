import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// BUILD FLOW brand colors — aligned with web `tailwind.config.js` / `index.css`.
class AppColors {
  static const Color primary = Color(0xFF0F9D94);
  static const Color primaryHover = Color(0xFF14B8A6);
  static const Color secondary = Color(0xFF14B8A6);
  static const Color accent = Color(0xFFF59E0B);
  static const Color success = Color(0xFF10B981);
  static const Color danger = Color(0xFFE11D48);
  static const Color lightBg = Color(0xFFF1F5F9);
  static const Color card = Color(0xFFF8FAFC);
  static const Color darkNavy = Color(0xFF0F172A);
  static const Color darkSecondary = Color(0xFF111827);
  static const Color darkCard = Color(0xFF111827);
  static const Color darkBorder = Color(0xFF1E293B);
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color darkMuted = Color(0xFF94A3B8);
  static const Color border = Color(0xFFE2E8F0);
  static const Color slate400 = Color(0xFF94A3B8);
  static const Color slate700 = Color(0xFF334155);

  // Metric accents (web parity)
  static const Color users = Color(0xFF2563EB);
  static const Color usersBg = Color(0xFFEFF6FF);
  static const Color projects = Color(0xFF0F9D94);
  static const Color projectsBg = Color(0xFFECFDF5);
  static const Color materials = Color(0xFF6366F1);
  static const Color materialsBg = Color(0xFFEEF2FF);
  static const Color suppliers = Color(0xFFF59E0B);
  static const Color suppliersBg = Color(0xFFFFF7ED);
  static const Color orders = Color(0xFF475569);
  static const Color ordersBg = Color(0xFFF1F5F9);
  static const Color deliveries = Color(0xFF10B981);
  static const Color deliveriesBg = Color(0xFFECFDF5);
  static const Color payments = Color(0xFFE11D48);
  static const Color paymentsBg = Color(0xFFFFF1F2);
}

class AppTheme {
  static const double radius = 14;
  static const double radiusSm = 12;
  static const double radiusLg = 16;

  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        tertiary: AppColors.accent,
        error: AppColors.danger,
        surface: AppColors.card,
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: AppColors.lightBg,
    );
    return _apply(base, dark: false);
  }

  static ThemeData dark() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        tertiary: AppColors.accent,
        error: AppColors.danger,
        surface: AppColors.darkCard,
        brightness: Brightness.dark,
      ),
      scaffoldBackgroundColor: AppColors.darkNavy,
    );
    return _apply(base, dark: true);
  }

  static ThemeData _apply(ThemeData base, {required bool dark}) {
    final text = GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: dark ? Colors.white : AppColors.textPrimary,
      displayColor: dark ? Colors.white : AppColors.textPrimary,
    );

    final fill = dark ? AppColors.darkSecondary : AppColors.card;
    final borderColor = dark ? AppColors.darkBorder : AppColors.border;
    final surface = dark ? AppColors.darkCard : AppColors.card;

    return base.copyWith(
      textTheme: text,
      dividerColor: borderColor,
      appBarTheme: AppBarTheme(
        backgroundColor: surface.withValues(alpha: dark ? 0.94 : 0.92),
        foregroundColor: dark ? Colors.white : AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: text.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
          color: dark ? Colors.white : AppColors.textPrimary,
          fontSize: 18,
          letterSpacing: -0.2,
        ),
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: AppColors.darkNavy,
        surfaceTintColor: Colors.transparent,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.slate400,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        selectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
        unselectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w500,
          fontSize: 11,
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shadowColor: AppColors.darkNavy.withValues(alpha: 0.08),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: borderColor),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
        ),
        titleTextStyle: text.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
          color: dark ? Colors.white : AppColors.textPrimary,
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
        ),
      ),
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        side: BorderSide.none,
        labelStyle: text.labelMedium?.copyWith(fontWeight: FontWeight.w600),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: fill,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(radiusSm)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        labelStyle: TextStyle(color: AppColors.textSecondary.withValues(alpha: 0.95)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.45),
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusSm),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          side: BorderSide(color: borderColor),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusSm),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.darkNavy,
        contentTextStyle: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w600,
        ),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
      ),
      listTileTheme: ListTileThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
        ),
        iconColor: dark ? AppColors.darkMuted : AppColors.textSecondary,
      ),
    );
  }
}
