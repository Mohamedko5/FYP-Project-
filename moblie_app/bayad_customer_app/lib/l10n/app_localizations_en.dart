// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Bayad Customer';

  @override
  String get companyName => 'Bayad Commercial Activities Company';

  @override
  String get systemName => 'Integrated Agricultural Trading System';

  @override
  String get splashLoading => 'Preparing customer portal...';

  @override
  String get retry => 'Retry';

  @override
  String get loginTitle => 'Customer Login';

  @override
  String get loginSubtitle => 'Sign in to access your Bayad customer account.';

  @override
  String get emailAddress => 'Email Address';

  @override
  String get password => 'Password';

  @override
  String get enterEmail => 'Enter email address';

  @override
  String get enterPassword => 'Enter password';

  @override
  String get showPassword => 'Show password';

  @override
  String get hidePassword => 'Hide password';

  @override
  String get login => 'Login';

  @override
  String get signingIn => 'Signing in...';

  @override
  String get logout => 'Logout';

  @override
  String get profile => 'Profile';

  @override
  String get home => 'Home';

  @override
  String get products => 'Products';

  @override
  String get myOrders => 'My Orders';

  @override
  String get myInvoices => 'My Invoices';

  @override
  String get myShipments => 'My Shipments';

  @override
  String get customerCode => 'Customer Code';

  @override
  String get customerName => 'Customer Name';

  @override
  String get phone => 'Phone';

  @override
  String get secondaryPhone => 'Secondary Phone';

  @override
  String get address => 'Address';

  @override
  String get customerType => 'Customer Type';

  @override
  String greeting(String name) {
    return 'Welcome, $name';
  }

  @override
  String get phaseOnePlaceholder =>
      'This customer module will be implemented in the next development phase.';

  @override
  String get emptyEmail => 'Please enter your email address.';

  @override
  String get invalidEmail => 'Please enter a valid email address.';

  @override
  String get emptyPassword => 'Please enter your password.';

  @override
  String get invalidCredentials => 'Invalid email or password.';

  @override
  String get inactiveAccount => 'Your customer account is inactive.';

  @override
  String get serverUnavailable => 'Unable to connect to the server.';

  @override
  String get sessionExpired => 'Your session has expired.';

  @override
  String get unknownError => 'Something went wrong. Please try again.';

  @override
  String get emptyState => 'No records are available yet.';

  @override
  String get routeError => 'This page is not available.';

  @override
  String get language => 'العربية';
}
