class ApiEndpoints {
  static const mobileLogin = '/api/mobile/auth/login/';
  static const mobileRegister = '/api/mobile/auth/register/';
  static const mobileVerifyEmail = '/api/mobile/auth/verify-email/';
  static const mobileResendVerification = '/api/mobile/auth/resend-verification/';
  static const mobileRegistrationStatus = '/api/mobile/auth/registration-status/';
  static const mobileForgotPassword = '/api/mobile/auth/forgot-password/';
  static const mobileVerifyResetCode = '/api/mobile/auth/verify-reset-code/';
  static const mobileResetPassword = '/api/mobile/auth/reset-password/';
  static const mobileRefresh = '/api/mobile/auth/refresh/';
  static const mobileLogout = '/api/mobile/auth/logout/';
  static const mobileMe = '/api/mobile/me/';
  static const homeSummary = '/api/mobile/home-summary/';
  static const products = '/api/mobile/products/';
  static const orders = '/api/mobile/orders/';
  static const invoices = '/api/mobile/invoices/';
  static const shipments = '/api/mobile/shipments/';

  static String productDetail(int id) => '/api/mobile/products/$id/';
  static String orderDetail(int id) => '/api/mobile/orders/$id/';
  static String invoiceDetail(int id) => '/api/mobile/invoices/$id/';
  static String shipmentDetail(int id) => '/api/mobile/shipments/$id/';
}
