import 'package:shared_preferences/shared_preferences.dart';

class PreferencesService {
  PreferencesService(this._preferences);

  static const languageKey = 'bayad_mobile_language';
  final SharedPreferences _preferences;

  String get languageCode => _preferences.getString(languageKey) ?? 'en';

  Future<void> setLanguageCode(String code) => _preferences.setString(languageKey, code);
}
