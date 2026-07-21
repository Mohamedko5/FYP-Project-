import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'preferences_service.dart';

final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('SharedPreferences must be overridden before app start.');
});

final preferencesServiceProvider = Provider<PreferencesService>((ref) {
  return PreferencesService(ref.watch(sharedPreferencesProvider));
});

final localeControllerProvider = StateNotifierProvider<LocaleController, Locale>((ref) {
  return LocaleController(ref.watch(preferencesServiceProvider));
});

class LocaleController extends StateNotifier<Locale> {
  LocaleController(this._preferences) : super(Locale(_preferences.languageCode));

  final PreferencesService _preferences;

  Future<void> toggle() async {
    final next = state.languageCode == 'ar' ? 'en' : 'ar';
    state = Locale(next);
    await _preferences.setLanguageCode(next);
  }
}
