class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );

  static const phoneRunNote = 'Run Django for a physical phone with: python manage.py runserver 0.0.0.0:8000';
}
