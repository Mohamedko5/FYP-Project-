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
  String get forgotPassword => 'نسيت كلمة المرور؟';

  @override
  String get createAccount => 'إنشاء حساب';

  @override
  String get newToBayad => 'مستخدم جديد في بياض؟';

  @override
  String get logout => 'تسجيل الخروج';

  @override
  String get profile => 'الملف الشخصي';

  @override
  String get account => 'الحساب';

  @override
  String get home => 'الرئيسية';

  @override
  String get loadingHome => 'جارٍ تحميل بوابة العميل...';

  @override
  String get homeLoadError =>
      'تعذر تحميل الصفحة الرئيسية. يرجى المحاولة مرة أخرى.';

  @override
  String get quickActions => 'الإجراءات السريعة';

  @override
  String get browseProducts => 'تصفح المنتجات';

  @override
  String get trackShipments => 'تتبع الشحنات';

  @override
  String get pendingOrders => 'الطلبات المعلقة';

  @override
  String get unpaidInvoices => 'الفواتير غير المدفوعة';

  @override
  String get processingShipments => 'الشحنات قيد المعالجة';

  @override
  String get completedOrders => 'الطلبات المكتملة';

  @override
  String get recentOrders => 'أحدث الطلبات';

  @override
  String get viewAllOrders => 'عرض كل الطلبات';

  @override
  String get noOrdersFound => 'لا توجد طلبات.';

  @override
  String get unpaidInvoiceNotice =>
      'لديك فاتورة غير مدفوعة. يرجى التواصل مع شركة بياض لإكمال الدفع.';

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

  @override
  String get registerTitle => 'إنشاء حساب';

  @override
  String get personalInformation => 'المعلومات الشخصية';

  @override
  String get fullName => 'الاسم الكامل';

  @override
  String get fullNameHint => 'أحمد محمد';

  @override
  String get businessName => 'اسم العمل أو الشركة';

  @override
  String get optional => 'اختياري';

  @override
  String get contactInformation => 'معلومات التواصل';

  @override
  String get phoneNumber => 'رقم الهاتف';

  @override
  String get phoneHint => '+249912345678';

  @override
  String get addressHint => 'أم درمان، السودان';

  @override
  String get businessInformation => 'معلومات النشاط';

  @override
  String get accountSecurity => 'أمان الحساب';

  @override
  String get confirmPassword => 'تأكيد كلمة المرور';

  @override
  String get repeatPassword => 'أعد إدخال كلمة المرور';

  @override
  String get acceptTerms => 'أوافق على الشروط';

  @override
  String get passwordRequirements =>
      'يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل، وحرف كبير، وحرف صغير، ورقم.';

  @override
  String get completeRequiredFields => 'يرجى إكمال جميع الحقول المطلوبة.';

  @override
  String get passwordsDoNotMatch => 'كلمتا المرور غير متطابقتين.';

  @override
  String get submitting => 'جاري الإرسال...';

  @override
  String get backToLogin => 'العودة إلى تسجيل الدخول';

  @override
  String get farmer => 'مزارع';

  @override
  String get investor => 'مستثمر';

  @override
  String get consumer => 'مستهلك';

  @override
  String get exporter => 'مصدر';

  @override
  String get factory => 'مصنع';

  @override
  String get supplier => 'مورد';

  @override
  String get emailVerification => 'تأكيد البريد الإلكتروني';

  @override
  String verificationInstruction(String email) {
    return 'أدخل الرمز المكون من ستة أرقام المرسل إلى $email.';
  }

  @override
  String get verificationCode => 'رمز التحقق';

  @override
  String get verifyEmail => 'تأكيد البريد';

  @override
  String get verifying => 'جاري التحقق...';

  @override
  String get resendCode => 'إعادة إرسال الرمز';

  @override
  String get enterSixDigitCode => 'أدخل رمز التحقق المكون من 6 أرقام.';

  @override
  String get pendingAdminApproval => 'بانتظار موافقة الإدارة';

  @override
  String get pendingApprovalMessage =>
      'تم تأكيد بريدك الإلكتروني. ستراجع شركة بياض طلب حسابك.';

  @override
  String get checkStatus => 'فحص الحالة';

  @override
  String get checking => 'جاري الفحص...';

  @override
  String get forgotPasswordInstruction =>
      'أدخل بريدك الإلكتروني وسنرسل رمز إعادة تعيين آمن إذا كان الحساب موجوداً.';

  @override
  String get sendResetCode => 'إرسال رمز إعادة التعيين';

  @override
  String get sending => 'جاري الإرسال...';

  @override
  String get resetCode => 'رمز إعادة التعيين';

  @override
  String resetCodeInstruction(String email) {
    return 'أدخل رمز إعادة التعيين المكون من ستة أرقام المرسل إلى $email.';
  }

  @override
  String get verifyCode => 'تأكيد الرمز';

  @override
  String get resetPassword => 'إعادة تعيين كلمة المرور';

  @override
  String get newPassword => 'كلمة المرور الجديدة';

  @override
  String get confirmNewPassword => 'تأكيد كلمة المرور الجديدة';

  @override
  String get repeatNewPassword => 'أعد إدخال كلمة المرور الجديدة';

  @override
  String get newPasswordRequirements =>
      'استخدم 8 أحرف على الأقل مع حرف كبير وحرف صغير ورقم.';

  @override
  String get saving => 'جاري الحفظ...';

  @override
  String get chat => 'المحادثة';

  @override
  String get bayadSupport => 'دعم بياض';

  @override
  String get typeAMessage => 'اكتب رسالة';

  @override
  String get send => 'إرسال';

  @override
  String get attachFile => 'إرفاق ملف';

  @override
  String get chooseImage => 'اختر صورة';

  @override
  String get choosePdf => 'اختر ملف PDF';

  @override
  String get shareCustomerCard => 'مشاركة بطاقة العميل';

  @override
  String get shareCardMessage =>
      'سيتم إرسال اسم العميل والرمز وبيانات التواصل ونوع الحساب إلى إدارة بياض.';

  @override
  String get shareCard => 'مشاركة البطاقة';

  @override
  String get viewAttachment => 'عرض المرفق';

  @override
  String get downloadAttachment => 'تنزيل المرفق';

  @override
  String get image => 'صورة';

  @override
  String get document => 'مستند';

  @override
  String get sent => 'تم الإرسال';

  @override
  String get delivered => 'تم التسليم';

  @override
  String get read => 'مقروءة';

  @override
  String get failedToSend => 'تعذر الإرسال';

  @override
  String get noMessagesYet => 'لا توجد رسائل بعد';

  @override
  String get startConversation => 'ابدأ محادثة مع إدارة بياض.';

  @override
  String get waitingForAdmin => 'بانتظار الإدارة';

  @override
  String get waitingForCustomer => 'بانتظار العميل';

  @override
  String get closed => 'مغلقة';

  @override
  String get unreadMessages => 'رسائل غير مقروءة';

  @override
  String get bankCardWarning =>
      'لا ترسل أرقام البطاقات البنكية أو الأرقام السرية أو كلمات المرور.';

  @override
  String get noAttachmentSelected => 'لم يتم اختيار مرفق';

  @override
  String get removeAttachment => 'إزالة المرفق';

  @override
  String get connectionFallback =>
      'يتم تحميل الرسائل من السجل الآمن في الخادم.';

  @override
  String get chooseAttachment => 'اختر مرفقاً';

  @override
  String get unsupportedFile => 'اختر صورة JPG أو PNG أو WebP أو مستند PDF.';

  @override
  String get shareCustomerCardTitle => 'مشاركة بطاقة العميل';

  @override
  String get contactBayad => 'تواصل مع بياض';

  @override
  String get sellToBayad => 'بيع منتجات إلى بياض';

  @override
  String get supplyOffers => 'عروض التوريد';

  @override
  String get mySupplyOffers => 'عروض التوريد الخاصة بي';

  @override
  String get product => 'المنتج';

  @override
  String get unit => 'الوحدة';

  @override
  String get quantity => 'الكمية';

  @override
  String get createSupplyOffer => 'إنشاء عرض توريد';

  @override
  String get addOfferItems => 'إضافة منتجات العرض';

  @override
  String get addProduct => 'إضافة منتج';

  @override
  String get proposedUnitPrice => 'السعر المقترح للوحدة';

  @override
  String get proposedTotal => 'إجمالي العرض المقترح';

  @override
  String get productLocation => 'موقع المنتجات';

  @override
  String get availabilityDate => 'تاريخ توفر المنتجات';

  @override
  String get qualityGrade => 'درجة الجودة';

  @override
  String get packagingDetails => 'تفاصيل التعبئة';

  @override
  String get uploadProductPhotos => 'رفع صور المنتجات';

  @override
  String get reviewOffer => 'مراجعة العرض';

  @override
  String get submitOffer => 'إرسال العرض';

  @override
  String get offerSubmitted => 'تم إرسال العرض';

  @override
  String get offerDetails => 'تفاصيل العرض';

  @override
  String get offerStatusTimeline => 'سجل حالة العرض';

  @override
  String get adminProposedPrice => 'السعر المقترح من الإدارة';

  @override
  String get acceptPrice => 'قبول السعر';

  @override
  String get declinePrice => 'رفض السعر';

  @override
  String get chatAboutThisOffer => 'محادثة حول هذا العرض';

  @override
  String get receivingWarehouse => 'مخزن الاستلام';

  @override
  String get regionState => 'الولاية أو المنطقة';

  @override
  String get city => 'المدينة';

  @override
  String get area => 'المنطقة';

  @override
  String get detailedAddress => 'العنوان التفصيلي';

  @override
  String get customerReference => 'مرجع العميل';

  @override
  String get customerNotes => 'ملاحظات العميل';

  @override
  String get loadingSupplyOffers => 'جاري تحميل عروض التوريد...';

  @override
  String get loadingProducts => 'جاري تحميل المنتجات...';

  @override
  String get supplyOfferLoadError => 'تعذر تحميل عروض التوريد.';

  @override
  String get supplyOfferSaveError => 'تعذر حفظ عرض التوريد.';

  @override
  String get noSupplyOffers => 'لا توجد عروض توريد بعد.';

  @override
  String get requiredField => 'هذا الحقل مطلوب.';

  @override
  String get positiveNumberRequired => 'أدخل رقماً أكبر من صفر.';

  @override
  String get productRequired => 'يرجى اختيار المنتج والوحدة.';

  @override
  String get duplicateProductUnit => 'لا يسمح بتكرار نفس المنتج والوحدة.';

  @override
  String get saved => 'تم الحفظ.';

  @override
  String get remove => 'إزالة';

  @override
  String get supplyOfferNotice =>
      'إرسال العرض لا يعني إتمام الشراء. ستقوم إدارة بياض بمراجعة المنتجات والسعر والموقع.';

  @override
  String get draft => 'مسودة';

  @override
  String get submitted => 'تم الإرسال';

  @override
  String get underReview => 'قيد المراجعة';

  @override
  String get newPriceProposed => 'تم اقتراح سعر جديد';

  @override
  String get customerAccepted => 'وافق العميل';

  @override
  String get customerDeclined => 'رفض العميل';

  @override
  String get approved => 'تمت الموافقة';

  @override
  String get rejected => 'مرفوض';

  @override
  String get awaitingProductReceipt => 'بانتظار استلام المنتجات';

  @override
  String get received => 'تم الاستلام';

  @override
  String get completed => 'مكتمل';
}
