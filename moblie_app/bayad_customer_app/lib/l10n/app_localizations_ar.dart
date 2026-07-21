// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTitle => 'تطبيق عملاء بياض';

  @override
  String get companyName => 'شركة بياض للأنشطة التجارية';

  @override
  String get systemName => 'نظام إدارة التجارة الزراعية المتكامل';

  @override
  String get splashLoading => 'جاري تجهيز بوابة العملاء...';

  @override
  String get retry => 'إعادة المحاولة';

  @override
  String get loginTitle => 'دخول العملاء';

  @override
  String get loginSubtitle => 'سجل الدخول للوصول إلى حسابك في بياض.';

  @override
  String get emailAddress => 'البريد الإلكتروني';

  @override
  String get password => 'كلمة المرور';

  @override
  String get enterEmail => 'أدخل البريد الإلكتروني';

  @override
  String get enterPassword => 'أدخل كلمة المرور';

  @override
  String get showPassword => 'إظهار كلمة المرور';

  @override
  String get hidePassword => 'إخفاء كلمة المرور';

  @override
  String get login => 'دخول';

  @override
  String get signingIn => 'جاري تسجيل الدخول...';

  @override
  String get logout => 'تسجيل الخروج';

  @override
  String get profile => 'الملف الشخصي';

  @override
  String get home => 'الرئيسية';

  @override
  String get products => 'المنتجات';

  @override
  String get myOrders => 'طلباتي';

  @override
  String get myInvoices => 'فواتيري';

  @override
  String get myShipments => 'شحناتي';

  @override
  String get customerCode => 'كود العميل';

  @override
  String get customerName => 'اسم العميل';

  @override
  String get phone => 'الهاتف';

  @override
  String get secondaryPhone => 'الهاتف الإضافي';

  @override
  String get address => 'العنوان';

  @override
  String get customerType => 'نوع العميل';

  @override
  String greeting(String name) {
    return 'مرحباً، $name';
  }

  @override
  String get phaseOnePlaceholder =>
      'سيتم تنفيذ هذا القسم للعملاء في مرحلة التطوير التالية.';

  @override
  String get emptyEmail => 'يرجى إدخال البريد الإلكتروني.';

  @override
  String get invalidEmail => 'يرجى إدخال بريد إلكتروني صحيح.';

  @override
  String get emptyPassword => 'يرجى إدخال كلمة المرور.';

  @override
  String get invalidCredentials =>
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.';

  @override
  String get inactiveAccount => 'حساب العميل غير نشط.';

  @override
  String get serverUnavailable => 'تعذر الاتصال بالخادم.';

  @override
  String get sessionExpired => 'انتهت جلستك.';

  @override
  String get unknownError => 'حدث خطأ. يرجى المحاولة مرة أخرى.';

  @override
  String get emptyState => 'لا توجد سجلات حالياً.';

  @override
  String get routeError => 'هذه الصفحة غير متاحة.';

  @override
  String get language => 'English';
}
